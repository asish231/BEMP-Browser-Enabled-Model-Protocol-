// Minimal Java bridge server prototype using SparkJava and Java-WebSocket
// Dependencies (Maven):
//  - com.sparkjava:spark-core:2.9.4
//  - org.java-websocket:Java-WebSocket:1.5.6
//  - com.google.code.gson:gson:2.10.1

import static spark.Spark.*;

import com.google.gson.Gson;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class BridgeServer {
    static class SendBody { String model; String prompt; Boolean new_chat; }

    static class QueueEntry { spark.Response res; }

    static class WsMsg { String action; String type; String requestId; String model; String text; String chunk; String status; Boolean newChat; }

    static Set<WebSocket> clients = Collections.newSetFromMap(new ConcurrentHashMap<>());
    static Map<String, spark.Response> queues = new ConcurrentHashMap<>();
    static Gson gson = new Gson();

    public static void main(String[] args) throws Exception {
        port(8765);

        // HTTP endpoint
        post("/send", (req, res) -> {
            SendBody body = gson.fromJson(req.body(), SendBody.class);
            if (body == null || body.model == null || body.prompt == null) {
                res.status(400);
                return "{\"error\":\"model and prompt required\"}";
            }
            String requestId = UUID.randomUUID().toString();
            res.type("application/x-ndjson");

            // Store response reference (Spark buffers; we simulate streaming by building the body)
            queues.put(requestId, res);

            StringBuilder sb = new StringBuilder();
            sb.append(gson.toJson(mapOf("type","status","text","Request queued"))).append("\n");

            // Send to WS clients
            WsMsg msg = new WsMsg();
            msg.action = "sendPrompt";
            msg.requestId = requestId;
            msg.model = body.model;
            msg.text = body.prompt;
            msg.newChat = body.new_chat != null && body.new_chat;
            broadcast(gson.toJson(msg));

            // Wait up to 120s building NDJSON output; real streaming requires a different HTTP stack (Servlet/SSE)
            long start = System.currentTimeMillis();
            while (System.currentTimeMillis() - start < 120000) {
                String key = "__acc__" + requestId;
                String part = Accumulator.take(key);
                if (part != null) {
                    sb.append(part);
                    if (part.contains("\"type\":\"done\"")) break;
                }
                Thread.sleep(50);
            }
            queues.remove(requestId);
            return sb.toString();
        });

        // WebSocket server
        WebSocketServer wss = new WebSocketServer(new InetSocketAddress("0.0.0.0", 8765), 0, Collections.emptyList(), 0) {
            @Override public void onOpen(WebSocket conn, ClientHandshake handshake) { clients.add(conn); }
            @Override public void onClose(WebSocket conn, int code, String reason, boolean remote) { clients.remove(conn); }
            @Override public void onMessage(WebSocket conn, String message) {
                try {
                    WsMsg msg = gson.fromJson(message, WsMsg.class);
                    if (msg.requestId == null) return;
                    if ("response".equals(msg.type)) {
                        emit(msg.requestId, gson.toJson(mapOf("type","done","text", msg.text)) + "\n");
                    } else if ("stream".equals(msg.type)) {
                        emit(msg.requestId, gson.toJson(mapOf("type","chunk","text", msg.chunk)) + "\n");
                    } else if ("status".equals(msg.type)) {
                        emit(msg.requestId, gson.toJson(mapOf("type","status","text", msg.status)) + "\n");
                    }
                } catch (Exception ignored) {}
            }
            @Override public void onError(WebSocket conn, Exception ex) { ex.printStackTrace(); }
            @Override public void onStart() { System.out.println("WS started on /ws not implemented via Java-WebSocket in Spark stack."); }
        };
        // NOTE: Java-WebSocket here binds a raw WS server on port 8765 root, not path /ws.
        // For a production-grade server use an integrated solution (Jetty + Spark or Spring WebFlux).
        wss.start();

        System.out.println("Java bridge (prototype) HTTP on :8765, WS raw on :8765 (no path). This is for demonstration only.");
    }

    static void broadcast(String payload) {
        for (WebSocket ws : clients) {
            try { ws.send(payload); } catch (Exception ignored) {}
        }
    }

    static void emit(String requestId, String ndjsonLine) throws IOException {
        Accumulator.add("__acc__" + requestId, ndjsonLine);
    }

    static Map<String, String> mapOf(String k1, String v1, String k2, String v2) {
        Map<String, String> m = new HashMap<>();
        m.put(k1, v1); m.put(k2, v2); return m;
    }

    // Simple static accumulator to simulate NDJSON body assembly
    static class Accumulator {
        private static final Map<String, StringBuilder> store = new ConcurrentHashMap<>();
        static void add(String key, String line) {
            store.computeIfAbsent(key, k -> new StringBuilder()).append(line);
        }
        static String take(String key) {
            StringBuilder sb = store.get(key);
            if (sb == null || sb.length() == 0) return null;
            String s = sb.toString();
            store.put(key, new StringBuilder());
            return s;
        }
    }
}
