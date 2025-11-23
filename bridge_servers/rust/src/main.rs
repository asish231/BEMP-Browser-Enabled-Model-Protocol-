// Minimal Rust bridge server prototype
// Cargo.toml deps: axum = { version = "0.7", features=["ws"] }, tokio = { version="1", features=["full"] }, serde = {version="1", features=["derive"]}, serde_json="1", uuid = {version="1", features=["v4"]}

use std::{collections::HashMap, sync::{Arc, Mutex}, time::Duration};
use axum::{extract::{State, WebSocketUpgrade}, routing::post, response::IntoResponse, http::StatusCode, Router};
use axum::extract::ws::{Message, WebSocket};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    clients: Arc<Mutex<Vec<axum::extract::ws::WebSocketSender>>>,
    queues: Arc<Mutex<HashMap<String, tokio::sync::mpsc::UnboundedSender<String>>>>,
}

#[derive(Deserialize)]
struct SendReq { model: String, prompt: String, #[serde(default)] new_chat: bool }

#[derive(Serialize, Deserialize, Debug)]
struct WsMsg { #[serde(skip_serializing_if="Option::is_none")] action: Option<String>, #[serde(skip_serializing_if="Option::is_none")] r#type: Option<String>, requestId: Option<String>, model: Option<String>, text: Option<String>, chunk: Option<String>, status: Option<String>, newChat: Option<bool> }

#[tokio::main]
async fn main() {
    let state = AppState { clients: Arc::new(Mutex::new(Vec::new())), queues: Arc::new(Mutex::new(HashMap::new())) };
    let app = Router::new()
        .route("/send", post(send))
        .route("/ws", axum::routing::get(ws_handler))
        .with_state(state.clone());

    println!("Rust bridge listening on 0.0.0.0:8765");
    axum::Server::bind(&"0.0.0.0:8765".parse().unwrap())
        .serve(app.into_make_service())
        .await
        .unwrap();
}

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: AppState) {
    let (tx, mut rx) = socket.split();
    let sender = tx;
    {
        let mut v = state.clients.lock().unwrap();
        v.push(sender);
    }

    while let Some(Ok(msg)) = rx.next().await {
        if let Message::Text(text) = msg {
            if let Ok(parsed) = serde_json::from_str::<WsMsg>(&text) {
                if let Some(request_id) = parsed.requestId.clone() {
                    if let Some(txs) = state.queues.lock().unwrap().get(&request_id) {
                        if let Some(t) = parsed.r#type.as_deref() {
                            match t {
                                "response" => { let _ = txs.send(format!("{}", serde_json::to_string(&serde_json::json!({"type":"done","text": parsed.text.unwrap_or_default()})).unwrap())); }
                                "stream" => { let _ = txs.send(format!("{}", serde_json::to_string(&serde_json::json!({"type":"chunk","text": parsed.chunk.unwrap_or_default()})).unwrap())); }
                                "status" => { let _ = txs.send(format!("{}", serde_json::to_string(&serde_json::json!({"type":"status","text": parsed.status.unwrap_or_default()})).unwrap())); }
                                _ => {}
                            }
                        }
                    }
                }
            }
        }
    }
}

async fn send(State(state): State<AppState>, axum::Json(body): axum::Json<SendReq>) -> impl IntoResponse {
    if body.model.is_empty() || body.prompt.is_empty() {
        return (StatusCode::BAD_REQUEST, "model and prompt required").into_response();
    }

    let request_id = Uuid::new_v4().to_string();

    // Create a channel to stream NDJSON lines
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();
    state.queues.lock().unwrap().insert(request_id.clone(), tx);

    // Initial status
    let _ = state.queues.lock().unwrap().get(&request_id).unwrap().send(serde_json::to_string(&serde_json::json!({"type":"status","text":"Request queued"})).unwrap());

    // Broadcast to all clients
    let msg = WsMsg { action: Some("sendPrompt".to_string()), r#type: None, requestId: Some(request_id.clone()), model: Some(body.model.clone()), text: Some(body.prompt.clone()), chunk: None, status: None, newChat: Some(body.new_chat) };
    let data = serde_json::to_string(&msg).unwrap();
    let clients = state.clients.lock().unwrap().clone();
    for mut sender in clients {
        let _ = sender.send(Message::Text(data.clone())).await;
    }

    // Timeout cleanup
    let queues = state.queues.clone();
    let rid = request_id.clone();
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_secs(120)).await;
        if let Some(tx) = queues.lock().unwrap().remove(&rid) {
            let _ = tx.send(serde_json::to_string(&serde_json::json!({"type":"error","text":"Timeout waiting for AI response"})).unwrap());
        }
    });

    // Stream NDJSON
    let stream = async_stream::stream! {
        while let Some(line) = rx.recv().await {
            yield Ok::<_, std::io::Error>(line + "\n");
        }
    };

    axum::response::Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "application/x-ndjson")
        .body(axum::body::Body::from_stream(stream))
        .unwrap()
}
