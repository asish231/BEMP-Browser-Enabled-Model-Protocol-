# AI Bridge Protocol Documentation

This documentation describes how to interact with the **AI Bridge Protocol**, a local WebSocket-based interface that allows you to programmatically control AI models running in your Chrome browser.

Supported web AIs: Gemini, ChatGPT, DeepSeek, Qwen, Kimi, Venice (uncensored), and Blackbox.

## Overview

The system consists of three parts:
1.  **Chrome Extension:** Runs in your browser, injecting scripts into AI tabs.
2.  **Bridge Server (Python):** A local WebSocket server (default: `ws://localhost:8765/ws`) that acts as the middleman.
3.  **Your Client:** Any program that can connect to a WebSocket.

**Base URL:** `ws://localhost:8765/ws`

---

## Protocol Specification

### 1. Sending a Prompt
To send a prompt to an AI model, send a JSON message to the WebSocket server with the following structure:

**Request Format:**
```json
{
  "action": "sendPrompt",
  "requestId": "unique-uuid-v4",
  "model": "gemini",  // or "chatgpt"
  "text": "Your prompt here"
}
```

| Field | Type | Description |
| :--- | :--- | :--- |
| `action` | `string` | Must be `"sendPrompt"`. |
| `requestId` | `string` | A unique identifier for this request (UUID v4 recommended). You will use this to match responses. |
| `model` | `string` | The target AI model. Options: `"gemini"`, `"chatgpt"`, `"deepseek"`, `"qwen"`, `"kimi"`, `"venice"`, `"blackbox"`. |
| `text` | `string` | The actual prompt you want to send. |
| `newChat` | `boolean` | (Optional) Set to `true` to start a fresh conversation before sending the prompt. |

### 3. Starting a New Chat
To ensure a clean context (forgetting previous messages), add `"newChat": true` to your request.

```json
{
  "action": "sendPrompt",
  "requestId": "...",
  "model": "gemini",
  "text": "Start a new topic about space.",
  "newChat": true
}
```

### 2. Receiving Responses
The server will stream JSON messages back to you. You should listen for messages matching your `requestId`.

**Response Types:**

*   **Status Update:**
    ```json
    { "type": "status", "requestId": "...", "status": "Thinking..." }
    ```
*   **Stream Chunk (Real-time text):**
    ```json
    { "type": "stream", "requestId": "...", "chunk": " The" }
    ```
*   **Final Response (Completion):**
    ```json
    { "type": "response", "requestId": "...", "text": "The full complete text..." }
    ```

---

## Code Examples

Below are examples of how to connect and send a request in various programming languages. Replace the model field with any supported value: gemini, chatgpt, deepseek, qwen, kimi, venice, blackbox.

### Python
```python
import asyncio
import websockets
import json
import uuid

async def ask_ai():
    uri = "ws://localhost:8765/ws"
    async with websockets.connect(uri) as websocket:
        request_id = str(uuid.uuid4())
        prompt = {
            "action": "sendPrompt",
            "requestId": request_id,
            "model": "gemini",
            "text": "Explain quantum computing in one sentence."
        }
        
        await websocket.send(json.dumps(prompt))
        
        while True:
            response = await websocket.recv()
            data = json.loads(response)
            
            if data.get("requestId") == request_id:
                if data["type"] == "stream":
                    print(data["chunk"], end="", flush=True)
                elif data["type"] == "response":
                    print("\n\nDone!")
                    break

asyncio.run(ask_ai())
```

### JavaScript (Node.js)
*Requires `ws` package: `npm install ws`*
```javascript
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const ws = new WebSocket('ws://localhost:8765/ws');

ws.on('open', function open() {
    const requestId = uuidv4();
    const payload = {
        action: "sendPrompt",
        requestId: requestId,
        model: "chatgpt",
        text: "Write a haiku about code."
    };
    ws.send(JSON.stringify(payload));

    ws.on('message', function message(data) {
        const response = JSON.parse(data);
        if (response.requestId === requestId) {
            if (response.type === 'stream') {
                process.stdout.write(response.chunk);
            } else if (response.type === 'response') {
                console.log("\n\nFinished.");
                ws.close();
            }
        }
    });
});
```

### Go (Golang)
*Requires `gorilla/websocket`: `go get github.com/gorilla/websocket`*
```go
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type Message struct {
	Action    string `json:"action,omitempty"`
	RequestId string `json:"requestId"`
	Model     string `json:"model,omitempty"`
	Text      string `json:"text,omitempty"`
	Type      string `json:"type,omitempty"`
	Chunk     string `json:"chunk,omitempty"`
}

func main() {
	c, _, err := websocket.DefaultDialer.Dial("ws://localhost:8765/ws", nil)
	if err != nil { log.Fatal(err) }
	defer c.Close()

	reqId := uuid.New().String()
	msg := Message{
		Action:    "sendPrompt",
		RequestId: reqId,
		Model:     "gemini",
		Text:      "Hello from Go!",
	}
	c.WriteJSON(msg)

	for {
		var resp Message
		err := c.ReadJSON(&resp)
		if err != nil { break }

		if resp.RequestId == reqId {
			if resp.Type == "stream" {
				fmt.Print(resp.Chunk)
			} else if resp.Type == "response" {
				fmt.Println("\nDone.")
				break
			}
		}
	}
}
```

### C++
*Requires a library like `Boost.Beast` or `uWebSockets`. Conceptual example:*
```cpp
// Conceptual pseudo-code using a generic websocket client
#include <iostream>
#include <nlohmann/json.hpp> // nlohmann/json library

using json = nlohmann::json;

void on_message(string message) {
    auto data = json::parse(message);
    if (data["type"] == "stream") {
        std::cout << data["chunk"].get<std::string>();
    } else if (data["type"] == "response") {
        std::cout << "\nDone." << std::endl;
        exit(0);
    }
}

int main() {
    WebSocketClient client("ws://localhost:8765/ws");
    
    json request = {
        {"action", "sendPrompt"},
        {"requestId", "unique-id-123"},
        {"model", "gemini"},
        {"text", "Hello from C++"}
    };
    
    client.send(request.dump());
    client.run(on_message);
    return 0;
}
```

### Java
*Requires `Java-WebSocket` library.*
```java
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;
import org.json.JSONObject;
import java.net.URI;
import java.util.UUID;

public class AIClient extends WebSocketClient {
    public AIClient(URI serverUri) { super(serverUri); }

    @Override
    public void onOpen(ServerHandshake handshakedata) {
        String reqId = UUID.randomUUID().toString();
        JSONObject json = new JSONObject();
        json.put("action", "sendPrompt");
        json.put("requestId", reqId);
        json.put("model", "chatgpt");
        json.put("text", "Hello from Java");
        send(json.toString());
    }

    @Override
    public void onMessage(String message) {
        JSONObject data = new JSONObject(message);
        if (data.has("type")) {
            if (data.getString("type").equals("stream")) {
                System.out.print(data.getString("chunk"));
            } else if (data.getString("type").equals("response")) {
                System.out.println("\nDone.");
                close();
            }
        }
    }

    // Implement onError, onClose...
    public static void main(String[] args) throws Exception {
        new AIClient(new URI("ws://localhost:8765/ws")).connect();
    }
}
```

### TypeScript
```typescript
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

interface AIResponse {
    type: 'status' | 'stream' | 'response';
    requestId: string;
    chunk?: string;
    text?: string;
    status?: string;
}

const ws = new WebSocket('ws://localhost:8765/ws');

ws.on('open', () => {
    const requestId = uuidv4();
    const payload = {
        action: "sendPrompt",
        requestId: requestId,
        model: "gemini",
        text: "Generate a TypeScript interface."
    };
    ws.send(JSON.stringify(payload));

    ws.on('message', (data: string) => {
        const response: AIResponse = JSON.parse(data);
        if (response.requestId === requestId) {
            if (response.type === 'stream' && response.chunk) {
                process.stdout.write(response.chunk);
            } else if (response.type === 'response') {
                console.log("\nDone.");
                ws.close();
            }
        }
    });
});
```

### PHP
*Requires `textalk/websocket` or similar composer package.*
```php
<?php
require 'vendor/autoload.php';

use WebSocket\Client;

$client = new Client("ws://localhost:8765/ws");
$requestId = uniqid();

$payload = json_encode([
    "action" => "sendPrompt",
    "requestId" => $requestId,
    "model" => "gemini",
    "text" => "Hello from PHP"
]);

$client->send($payload);

while (true) {
    try {
        $message = $client->receive();
        $data = json_decode($message, true);
        
        if ($data['requestId'] === $requestId) {
            if ($data['type'] === 'stream') {
                echo $data['chunk'];
            } elseif ($data['type'] === 'response') {
                echo "\nDone.\n";
                break;
            }
        }
    } catch (Exception $e) { break; }
}
?>
```

### Rust
*Requires `tungstenite`, `serde_json`, `uuid` crates.*
```rust
use tungstenite::{connect, Message};
use url::Url;
use serde_json::{json, Value};
use uuid::Uuid;

fn main() {
    let (mut socket, _) = connect(Url::parse("ws://localhost:8765/ws").unwrap()).expect("Can't connect");

    let request_id = Uuid::new_v4().to_string();
    let payload = json!({
        "action": "sendPrompt",
        "requestId": request_id,
        "model": "gemini",
        "text": "Hello from Rust"
    });

    socket.write_message(Message::Text(payload.to_string())).unwrap();

    loop {
        let msg = socket.read_message().expect("Error reading message");
        if let Message::Text(text) = msg {
            let v: Value = serde_json::from_str(&text).unwrap();
            if v["requestId"] == request_id {
                if v["type"] == "stream" {
                    print!("{}", v["chunk"].as_str().unwrap_or(""));
                } else if v["type"] == "response" {
                    println!("\nDone.");
                    break;
                }
            }
        }
    }
}
```

### C (using libwebsockets)
*Note: C implementation is verbose. This is a high-level pseudo-structure.*
```c
// Requires libwebsockets or similar
// 1. Establish connection to ws://localhost:8765/ws
// 2. Construct JSON string:
//    sprintf(json_buf, "{\"action\":\"sendPrompt\",\"requestId\":\"%s\",\"model\":\"gemini\",\"text\":\"Hello C\"}", uuid);
// 3. Send frame
// 4. In callback LWS_CALLBACK_CLIENT_RECEIVE:
//    Parse JSON. If type == "stream", printf("%s", chunk);
```

