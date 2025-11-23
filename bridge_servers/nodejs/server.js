// Minimal Node.js bridge server prototype
// Requirements: npm install express ws uuid cors

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

// Connected extension clients
const clients = new Set();
// requestId -> array of HTTP response writers or event emitters
const queues = new Map();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      const requestId = msg.requestId;
      if (!requestId) return;
      const q = queues.get(requestId);
      if (!q) return;

      // Map extension messages to NDJSON events
      if (msg.type === 'response') {
        q.res.write(JSON.stringify({ type: 'done', text: msg.text }) + '\n');
        cleanup(requestId);
      } else if (msg.type === 'stream') {
        q.res.write(JSON.stringify({ type: 'chunk', text: msg.chunk || '' }) + '\n');
      } else if (msg.type === 'status') {
        q.res.write(JSON.stringify({ type: 'status', text: msg.status || '' }) + '\n');
      }
    } catch (e) { /* ignore */ }
  });
});

function broadcast(obj) {
  const data = JSON.stringify(obj);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

function cleanup(requestId) {
  const entry = queues.get(requestId);
  if (entry && !entry.finished) {
    entry.finished = true;
    queues.delete(requestId);
  }
}

// POST /send -> NDJSON stream
app.post('/send', (req, res) => {
  const { model, prompt, new_chat = false } = req.body || {};
  if (!model || !prompt) {
    return res.status(400).json({ error: 'model and prompt are required' });
  }

  const requestId = uuidv4();
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.flushHeaders && res.flushHeaders();

  // Register queue
  queues.set(requestId, { res, finished: false });

  // Initial status
  res.write(JSON.stringify({ type: 'status', text: 'Request queued' }) + '\n');

  // Send to extension over WS
  broadcast({
    action: 'sendPrompt',
    requestId,
    model,
    text: prompt,
    newChat: !!new_chat
  });

  // Timeout
  const timeout = setTimeout(() => {
    if (!queues.has(requestId)) return;
    res.write(JSON.stringify({ type: 'error', text: 'Timeout waiting for AI response' }) + '\n');
    res.end();
    cleanup(requestId);
  }, 120000);

  // Ensure cleanup on close
  req.on('close', () => {
    clearTimeout(timeout);
    cleanup(requestId);
  });
});

const PORT = process.env.PORT || 8765;
server.listen(PORT, () => {
  console.log('Node bridge listening on http://localhost:' + PORT);
});
