// Minimal Go bridge server prototype
// go get github.com/gorilla/websocket github.com/google/uuid
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/google/uuid"
)

type QueueEntry struct {
	w        http.ResponseWriter
	finished bool
}

type WsMessage struct {
	Action    string `json:"action,omitempty"`
	Type      string `json:"type,omitempty"`
	RequestId string `json:"requestId,omitempty"`
	Model     string `json:"model,omitempty"`
	Text      string `json:"text,omitempty"`
	Chunk     string `json:"chunk,omitempty"`
	Status    string `json:"status,omitempty"`
	NewChat   bool   `json:"newChat,omitempty"`
}

var upgrader = websocket.Upgrader{ CheckOrigin: func(r *http.Request) bool { return true } }
var clientsMu sync.Mutex
var clients = make(map[*websocket.Conn]bool)

var queues sync.Map // map[string]*QueueEntry

func broadcast(msg WsMessage) {
	data, _ := json.Marshal(msg)
	clientsMu.Lock()
	defer clientsMu.Unlock()
	for c := range clients {
		c.WriteMessage(websocket.TextMessage, data)
	}
}

func cleanup(id string) {
	queues.Delete(id)
}

func wsHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil { return }
	clientsMu.Lock(); clients[conn] = true; clientsMu.Unlock()
	defer func() { clientsMu.Lock(); delete(clients, conn); clientsMu.Unlock(); conn.Close() }()

	for {
		_, data, err := conn.ReadMessage()
		if err != nil { return }
		var msg WsMessage
		if err := json.Unmarshal(data, &msg); err != nil { continue }
		if msg.RequestId == "" { continue }
		if v, ok := queues.Load(msg.RequestId); ok {
			qe := v.(*QueueEntry)
			switch msg.Type {
			case "response":
				fmt.Fprintf(qe.w, "%s\n", toJSON(map[string]string{"type": "done", "text": msg.Text}))
				if f, ok := qe.w.(http.Flusher); ok { f.Flush() }
				cleanup(msg.RequestId)
			case "stream":
				fmt.Fprintf(qe.w, "%s\n", toJSON(map[string]string{"type": "chunk", "text": msg.Chunk}))
				if f, ok := qe.w.(http.Flusher); ok { f.Flush() }
			case "status":
				fmt.Fprintf(qe.w, "%s\n", toJSON(map[string]string{"type": "status", "text": msg.Status}))
				if f, ok := qe.w.(http.Flusher); ok { f.Flush() }
			}
		}
	}
}

func toJSON(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}

func sendHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Model   string `json:"model"`
		Prompt  string `json:"prompt"`
		NewChat bool   `json:"new_chat"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), 400); return
	}
	if body.Model == "" || body.Prompt == "" { http.Error(w, "model and prompt required", 400); return }

	id := uuid.New().String()
	w.Header().Set("Content-Type", "application/x-ndjson")
	if f, ok := w.(http.Flusher); ok { f.Flush() }

	queues.Store(id, &QueueEntry{w: w, finished: false})
	fmt.Fprintf(w, "%s\n", toJSON(map[string]string{"type": "status", "text": "Request queued"}))
	if f, ok := w.(http.Flusher); ok { f.Flush() }

	broadcast(WsMessage{ Action: "sendPrompt", RequestId: id, Model: body.Model, Text: body.Prompt, NewChat: body.NewChat })

	// timeout handler
	go func() {
		t := time.NewTimer(120 * time.Second)
		<-t.C
		if v, ok := queues.Load(id); ok {
			qe := v.(*QueueEntry)
			fmt.Fprintf(qe.w, "%s\n", toJSON(map[string]string{"type": "error", "text": "Timeout waiting for AI response"}))
			if f, ok := qe.w.(http.Flusher); ok { f.Flush() }
			cleanup(id)
		}
	}()
}

func main() {
	http.HandleFunc("/ws", wsHandler)
	http.HandleFunc("/send", sendHandler)
	log.Println("Go bridge listening on :8765")
	log.Fatal(http.ListenAndServe(":8765", nil))
}
