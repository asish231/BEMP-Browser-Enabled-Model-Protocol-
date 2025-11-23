<?php
// Minimal PHP bridge server prototype using Swoole
// Requirements: pecl install swoole (or Docker with Swoole), then run: php server.php
use Swoole\Http\Server as HttpServer;
use Swoole\WebSocket\Server as WsServer;
use Swoole\WebSocket\Frame;
use Swoole\Coroutine\Channel;

$host = '0.0.0.0';
$port = 8765;

$ws = new WsServer($host, $port);
$ws->set(['open_http2_protocol' => false]);

$clients = []; // fd => true
$queues = [];  // requestId => [ 'chan' => Channel, 'fd' => int ]

$ws->on('Open', function($server, $req) use (&$clients) {
    $clients[$req->fd] = true;
});

$ws->on('Close', function($server, $fd) use (&$clients) {
    unset($clients[$fd]);
});

$ws->on('Message', function($server, Frame $frame) use (&$queues) {
    $data = json_decode($frame->data, true);
    if (!$data || empty($data['requestId'])) return;
    $rid = $data['requestId'];
    if (!isset($queues[$rid])) return;
    $chan = $queues[$rid]['chan'];

    if (($data['type'] ?? '') === 'response') {
        $chan->push(json_encode(['type' => 'done', 'text' => $data['text'] ?? '']));
    } elseif (($data['type'] ?? '') === 'stream') {
        $chan->push(json_encode(['type' => 'chunk', 'text' => $data['chunk'] ?? '']));
    } elseif (($data['type'] ?? '') === 'status') {
        $chan->push(json_encode(['type' => 'status', 'text' => $data['status'] ?? '']));
    }
});

$ws->on('request', function($request, $response) use (&$ws, &$clients, &$queues) {
    if ($request->server['request_uri'] !== '/send' || $request->server['request_method'] !== 'POST') {
        $response->status(404);
        $response->end('Not Found');
        return;
    }

    $body = json_decode($request->rawContent(), true);
    if (!$body || empty($body['model']) || empty($body['prompt'])) {
        $response->status(400);
        $response->end(json_encode(['error' => 'model and prompt required']));
        return;
    }

    $requestId = uniqid('req_', true);
    $response->header('Content-Type', 'application/x-ndjson');

    $chan = new Channel(100);
    $queues[$requestId] = ['chan' => $chan, 'fd' => $request->fd ?? 0];

    $response->write(json_encode(['type' => 'status', 'text' => 'Request queued']) . "\n");

    $payload = json_encode([
        'action' => 'sendPrompt',
        'requestId' => $requestId,
        'model' => $body['model'],
        'text' => $body['prompt'],
        'newChat' => !empty($body['new_chat'])
    ]);

    foreach ($ws->connections as $fd) {
        if ($ws->isEstablished($fd)) {
            $ws->push($fd, $payload);
        }
    }

    // Timeout 120s in a coroutine
    go(function() use ($chan, $response, $requestId, &$queues) {
        $deadline = time() + 120;
        while (true) {
            $remaining = $deadline - time();
            if ($remaining <= 0) {
                $response->write(json_encode(['type' => 'error', 'text' => 'Timeout waiting for AI response']) . "\n");
                $response->end();
                unset($queues[$requestId]);
                break;
            }
            $msg = $chan->pop($remaining);
            if ($msg === false) continue;
            $response->write($msg . "\n");
            if (strpos($msg, '"type":"done"') !== false) {
                $response->end();
                unset($queues[$requestId]);
                break;
            }
        }
    });
});

$ws->start();
