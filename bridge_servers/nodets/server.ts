// Minimal TypeScript bridge server prototype
// Requirements: npm install express ws uuid cors @types/express @types/ws @types/cors
import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const clients = new Set<WebSocket>();
const queues: Map<string, { res: any; finished: boolean } > = new Map();

wss.on('connection', (ws: WebSocket) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  ws.on('message', (raw: string) => {
    try {
      const msg = JSON.parse(raw.toString());
      const requestId = msg.requestId as string;
      if (!requestId) return;
      const q = queues.get(requestId);
      if (!q) return;

      if (msg.type === 'response') {
        q.res.write(JSON.stringify({ type: 'done', text: msg.text }) + '\n');
        cleanup(requestId);
      } else if (msg.type === 'stream') {
        q.res.write(JSON.stringify({ type: 'chunk', text: msg.chunk || '' }) + '\n');
      } else if (msg.type === 'status') {
        q.res.write(JSON.stringify({ type: 'status', text: msg.status || '' }) + '\n');
      }
    } catch (e) {}
  });
});

function broadcast(obj: any) {
  const data = JSON.stringify(obj);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

function cleanup(requestId: string) {
  const entry = queues.get(requestId);
  if (entry && !entry.finished) {
    entry.finished = true;
    queues.delete(requestId);
  }
}

app.post('/send', (req, res) => {
  const { model, prompt, new_chat = false } = req.body || {};
  if (!model || !prompt) return res.status(400).json({ error: 'model and prompt are required' });

  const requestId = uuidv4();
  res.setHeader('Content-Type', 'application/x-ndjson');

  queues.set(requestId, { res, finished: false });
  res.write(JSON.stringify({ type: 'status', text: 'Request queued' }) + '\n');

  broadcast({ action: 'sendPrompt', requestId, model, text: prompt, newChat: !!new_chat });

  const timeout = setTimeout(() => {
    if (!queues.has(requestId)) return;
    res.write(JSON.stringify({ type: 'error', text: 'Timeout waiting for AI response' }) + '\n');
    res.end();
    cleanup(requestId);
  }, 120000);

  req.on('close', () => {
    clearTimeout(timeout);
    cleanup(requestId);
  });
});

const PORT = process.env.PORT || 8765;
server.listen(PORT, () => console.log(`TS bridge listening on http://localhost:${PORT}`));
