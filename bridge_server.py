import asyncio
import json
import uuid
from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict

SERVER_VERSION = "2.0-streaming"

app = FastAPI()

print("="*60)
print(f"Bridge Server v{SERVER_VERSION} Starting...")
print("="*60)

# Store connected extension clients
connected_clients: List[WebSocket] = []

# Store pending response queues: request_id -> asyncio.Queue
response_queues: Dict[str, asyncio.Queue] = {}

class PromptRequest(BaseModel):
    model: str
    prompt: str
    new_chat: bool = False

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    print("Extension connected!")
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            req_id = message.get("requestId")
            if req_id and req_id in response_queues:
                queue = response_queues[req_id]
                
                if message.get("type") == "response":
                    # Final response
                    await queue.put({"type": "done", "text": message.get("text")})
                elif message.get("type") == "stream":
                    # Stream chunk
                    await queue.put({"type": "chunk", "text": message.get("chunk")})
                elif message.get("type") == "status":
                    # Status update
                    await queue.put({"type": "status", "text": message.get("status")})
                        
    except Exception as e:
        print(f"Connection lost: {e}")
    finally:
        if websocket in connected_clients:
            connected_clients.remove(websocket)

@app.post("/send")
async def send_prompt(request: PromptRequest):
    if not connected_clients:
        raise HTTPException(status_code=503, detail="No Chrome extension connected")
    
    request_id = str(uuid.uuid4())
    
    message = json.dumps({
        "action": "sendPrompt",
        "requestId": request_id,
        "model": request.model,
        "text": request.prompt,
        "newChat": request.new_chat
    })
    
    # Create a queue for this request
    queue = asyncio.Queue()
    response_queues[request_id] = queue
    
    # Broadcast to extension
    for client in connected_clients:
        await client.send_text(message)
        
    async def event_generator():
        # Yield an initial status to confirm we started
        yield json.dumps({"type": "status", "text": "Request queued"}) + "\n"
        
        first_event_time = None
        buffered_text = []
        try:
            while True:
                # Wait for next event (timeout 120s)
                data = await asyncio.wait_for(queue.get(), timeout=120.0)

                # Track first event time and buffer chunks for fallback
                if first_event_time is None:
                    first_event_time = asyncio.get_event_loop().time()
                if data["type"] == "chunk":
                    buffered_text.append(data.get("text", ""))

                if data["type"] == "done":
                    # Prefer final done text over buffered
                    yield json.dumps(data) + "\n"
                    break
                else:
                    yield json.dumps(data) + "\n"

                # Removed 5s fallback to allow full generation

        except asyncio.TimeoutError:
            yield json.dumps({"type": "error", "text": "Timeout waiting for AI response"}) + "\n"
        finally:
            response_queues.pop(request_id, None)

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8765)
