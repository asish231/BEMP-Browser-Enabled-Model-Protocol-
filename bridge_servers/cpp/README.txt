This directory contains guidance for a C++ prototype.

Recommended stack:
- Boost.Beast for HTTP + WebSocket
- Asio for async IO

Sketch:
- An HTTP handler for POST /send that:
  - parses JSON {model, prompt, new_chat}
  - allocates a requestId and stores a queue (e.g., std::deque<std::string>) mapped by requestId
  - responds with chunked NDJSON; write() lines as WS events arrive
- A WebSocket endpoint /ws that:
  - keeps a list of connected ws sessions
  - on each message with {type, requestId, ...} looks up the queue and pushes NDJSON lines accordingly

See Beast examples:
- HTTP server async: https://www.boost.org/doc/libs/release/libs/beast/example/http/server/async/http_server_async.cpp
- WebSocket server async: https://www.boost.org/doc/libs/release/libs/beast/example/websocket/server/async/websocket_server_async.cpp

Implementation is verbose; for a working lightweight example, consider using the Go or Node version first.
