# Bridge Server Deployment and Usage Guide

This document provides a production-oriented tutorial for running the bridge server in multiple languages, explains routing, and shows how to operate the system end-to-end with the Chrome extension and the supported web AIs.

Contents
- Architecture overview
- Routing and ports
- Supported providers and model identifiers
- Prerequisites
- Quickstart: end-to-end flow
- Running the bridge server (per language)
  - Node.js (JavaScript)
  - Node.js (TypeScript)
  - Go
  - Rust
  - PHP (Swoole)
  - Java (prototype)
  - C++ (notes)
- Testing the API-like interface
- Operating considerations
  - Concurrency
  - Security & hardening
  - Reliability & monitoring
  - Configuration & customization
- Troubleshooting


## Architecture overview
The project mimics an API for multiple web-based AI providers using a local bridge and a Chrome extension:
- Your client sends an HTTP POST /send to the local bridge.
- The bridge relays a command over a WebSocket to the Chrome extension.
- The extension automates the provider’s web UI (in an open, logged-in browser tab), streams response text back over WebSocket.
- The bridge streams the response to your client as NDJSON lines (status/chunk/done).

This approach lets you prototype “API-like” usage without an official API, at the expense of reliance on the provider’s web UI/DOM.


## Routing and ports
- Default bridge endpoints (expected by the Chrome extension):
  - WebSocket: ws://localhost:8765/ws
  - HTTP: POST http://localhost:8765/send
- Only one bridge server should run on port 8765 at a time.
- If you need a different port, either
  - update the extension’s WebSocket URL in gemini-extension/background.js, or
  - ensure your alternative server binds to ws://localhost:8765/ws and POST /send.

Note on Java prototype:
- The included Java example demonstrates the flow but does not mount a /ws path using the provided WebSocket library. For compatibility with the extension as-is, either:
  - adapt the Java server to expose ws://localhost:8765/ws (recommended), or
  - change the extension to match the Java server’s actual WebSocket endpoint.


## Supported providers and model identifiers
- Gemini: "gemini"
- ChatGPT: "chatgpt"
- DeepSeek: "deepseek"
- Qwen: "qwen"
- Kimi: "kimi"
- Venice: "venice"
- Blackbox: "blackbox"

The client payload uses the model key with one of the above values.


## Prerequisites
- Chrome browser with the extension loaded (gemini-extension/):
  - chrome://extensions -> Enable Developer mode -> Load unpacked -> select gemini-extension folder
- Open a browser tab for the target provider and ensure you’re logged in.
- One of the bridge servers running on localhost:8765.
- Optional: Python 3 if you want to use test_protocol.py for testing.


## Quickstart: end-to-end flow
1) Load the Chrome extension (see Prerequisites) and open the target provider’s tab.
2) Start one of the bridge servers (see next section) so it listens on http://localhost:8765 and ws://localhost:8765/ws.
3) Verify the extension connects:
   - The extension background console will log "Connected to Bridge Server".
4) Send a test request from a client:
   - Using curl:
     curl -N -H "Content-Type: application/json" \
       -d "{\"model\":\"gemini\",\"prompt\":\"Say hello\",\"new_chat\":true}" \
       http://localhost:8765/send
   - Using Python helper:
     python test_protocol.py
5) Observe NDJSON streaming in your terminal and the response appearing in the provider’s tab.


## Running the bridge server (per language)
All servers are located under bridge_servers/ and expose:
- WebSocket at /ws
- HTTP POST /send with NDJSON streaming

Only one server should run at a time on port 8765.

### Node.js (JavaScript)
Path: bridge_servers/nodejs/server.js
Requirements: Node 18+ recommended

Commands:
- cd bridge_servers/nodejs
- npm init -y
- npm i express ws uuid cors
- node server.js

The server logs: "Node bridge listening on http://localhost:8765".

### Node.js (TypeScript)
Path: bridge_servers/nodets/server.ts
Requirements: Node 18+, TypeScript toolchain

Commands:
- cd bridge_servers/nodets
- npm init -y
- npm i express ws uuid cors
- npm i -D typescript ts-node @types/express @types/ws @types/cors
- npx ts-node server.ts

The server logs: "TS bridge listening on http://localhost:8765".

### Go
Path: bridge_servers/go/main.go
Requirements: Go 1.20+

Commands:
- cd bridge_servers/go
- go mod init bridge-go
- go get github.com/gorilla/websocket github.com/google/uuid
- go run main.go

The server logs: "Go bridge listening on :8765".

### Rust
Path: bridge_servers/rust/src/main.rs
Requirements: Rust stable, Cargo

Create Cargo.toml with:
[package]
name = "bridge-rust"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = { version = "0.7", features = ["ws"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4"] }
async-stream = "0.3"

Commands:
- cd bridge_servers/rust
- cargo run

The server logs: "Rust bridge listening on 0.0.0.0:8765".

### PHP (Swoole)
Path: bridge_servers/php/server.php
Requirements: PHP with Swoole extension (pecl install swoole)

Commands:
- cd bridge_servers/php
- php server.php

The server starts a combined HTTP+WebSocket service on port 8765.

### Java (prototype)
Path: bridge_servers/java/src/main/java/BridgeServer.java
Requirements: JDK 17+ and Maven/Gradle dependencies:
- com.sparkjava:spark-core:2.9.4
- org.java-websocket:Java-WebSocket:1.5.6
- com.google.code.gson:gson:2.10.1

Notes:
- This demo assembles NDJSON in memory and does not expose a /ws path via the shown library setup.
- For compatibility with the existing Chrome extension, prefer implementing /ws using Jetty or Spring WebFlux WebSocket and streaming HTTP responses using reactive I/O.
- Alternatively, update the extension WebSocket URL to the actual WS endpoint provided by your Java stack.

### C++ (notes)
Path: bridge_servers/cpp/README.txt
- Use Boost.Beast for HTTP + WebSocket and Asio for async I/O.
- Implement POST /send and a /ws endpoint similar to the other examples.
- Due to verbosity and platform specifics, a complete sample is omitted; consider Go/Node/Rust for faster prototyping.


## Testing the API-like interface
You can test with curl or the included Python script.

- curl (NDJSON stream):
  curl -N -H "Content-Type: application/json" \
    -d "{\"model\":\"gemini\",\"prompt\":\"Say hello\"}" \
    http://localhost:8765/send

- Python helper (test_protocol.py):
  python test_protocol.py

Expected NDJSON structure (one JSON object per line):
- {"type":"status","text":"..."}
- {"type":"chunk","text":" partial text ..."}
- {"type":"done","text":" full final text ..."}


## Operating considerations

### Concurrency
- A single browser tab per provider is recommended.
- Avoid overlapping prompts to the same provider/tab; serialize per-provider requests.
- You can open multiple provider tabs and send requests to different providers concurrently.

### Security & hardening
- Bind the server to localhost only (default) to avoid exposing it on the network.
- If remote usage is required, place a reverse proxy (nginx/Caddy) with HTTPS and IP allowlists.
- Add lightweight authentication (e.g., shared token in an Authorization header) if needed.
- Consider rate limits and request size limits.

### Reliability & monitoring
- Add timeouts (already included ~120s) and surface errors back to clients.
- Log request lifecycle events and provider status updates.
- Use a process manager:
  - Windows: NSSM (Non-Sucking Service Manager) to run as a service
  - Linux: systemd unit, e.g., After=network.target, Restart=always

### Configuration & customization
- Ports: default 8765. If you change it, update extension/gateway as needed.
- WebSocket path: extension expects /ws. Keep it consistent or adjust the extension.
- CORS: For HTTP /send, enable CORS if your client is a browser app on a different origin.


## Troubleshooting
- Error: No Chrome extension connected
  - Ensure the extension is loaded and the background page shows "Connected to Bridge Server".
  - Verify the server is running on ws://localhost:8765/ws.

- Error: No <model> tab found. Please open it.
  - Open the provider tab and ensure you’re logged in.

- Timeout waiting for AI response
  - The site may be busy or DOM selectors may have changed. Check the provider tab UI.

- 8765 already in use
  - Stop other servers bound to this port, or change the port consistently across the server and extension.

- Java server does not receive the WebSocket connection
  - Ensure your Java stack exposes ws://localhost:8765/ws or update the extension URL.

- Streaming seems choppy or missing
  - Verify the extension content script is successfully scraping DOM and sending promptStream events.
  - Check console logs in the provider tab and the extension background page.


## Summary
- Choose one bridge server implementation (Node/TS/Go/Rust/PHP/Java) and run it on localhost:8765 with a /ws endpoint and POST /send.
- Load the Chrome extension and open the provider’s tab.
- Send prompts to the bridge; consume NDJSON streaming results.
- For production-like use, focus on Node/Go/Rust for robust streaming and straightforward /ws support, add security controls, and run under a service manager.
