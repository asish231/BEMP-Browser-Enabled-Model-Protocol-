let socket = null;
let isConnected = false;

function connect() {
    console.log("Connecting to Bridge Server...");
    socket = new WebSocket('ws://localhost:8765/ws');

    socket.onopen = () => {
        console.log("Connected to Bridge Server");
        isConnected = true;
        setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "ping" }));
            }
        }, 30000);
    };

    socket.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log("Received command:", data);

        if (data.action === "sendPrompt") {
            await handleSendPrompt(data.text, data.model, data.requestId, data.newChat);
        }
    };

    socket.onclose = () => {
        console.log("Disconnected. Retrying...");
        isConnected = false;
        setTimeout(connect, 5000);
    };

    socket.onerror = (error) => console.error("WebSocket Error:", error);
}

// Listen for messages from content script (the response)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
        if (request.action === "promptResponse") {
            console.log("Got response from content script:", request);
            socket.send(JSON.stringify({
                type: "response",
                requestId: request.requestId,
                text: request.text
            }));
        } else if (request.action === "promptStatus") {
            socket.send(JSON.stringify({
                type: "status",
                requestId: request.requestId,
                status: request.status
            }));
        } else if (request.action === "promptStream") {
            socket.send(JSON.stringify({
                type: "stream",
                requestId: request.requestId,
                chunk: request.chunk
            }));
        }
    }
});

async function handleSendPrompt(text, model, requestId, newChat) {
    const patternMap = {
        // Restrict Gemini to its actual host to avoid matching unrelated google.com tabs
        gemini: ["*://gemini.google.com/*"],
        chatgpt: ["*://*.chatgpt.com/*", "*://*.openai.com/*"],
        deepseek: ["*://chat.deepseek.com/*"],
        qwen: ["*://chat.qwen.ai/*"],
        kimi: ["*://www.kimi.com/*", "*://kimi.moonshot.cn/*"],
        venice: ["*://venice.ai/*"],
        blackbox: ["*://www.blackbox.ai/*", "*://blackbox.ai/*"]
    };

    const urlPatterns = patternMap[model] || [];

    try {
        // Query for tabs matching ANY of the patterns
        let tabs = [];
        for (const pattern of urlPatterns) {
            const found = await chrome.tabs.query({ url: pattern });
            tabs = tabs.concat(found);
        }

        if (tabs.length === 0) {
            console.error(`No ${model} tab open.`);
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: "status",
                    requestId: requestId,
                    status: `Error: No ${model} tab found. Please open it.`
                }));
            }
            return;
        }

        // Use the first active tab if possible, otherwise just the first one found
        const tab = tabs.find(t => t.active) || tabs[0];

        // Function to send message with retry logic
        const trySend = async () => {
            return await chrome.tabs.sendMessage(tab.id, {
                action: "sendPrompt",
                text: text,
                model: model,
                requestId: requestId,
                newChat: newChat
            });
        };

        try {
            await trySend();
        } catch (err) {
            const msg = err && err.message ? err.message : String(err);

            // If Chrome blocks access due to host permissions, surface a clear status
            if (msg.includes("Cannot access contents of the page")) {
                console.error("Host permission error for tab", tab.id, "url:", tab.url, "message:", msg);
                if (socket && socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({
                        type: "status",
                        requestId: requestId,
                        status: `Error: Cannot access contents of ${tab.url}. Please ensure the extension host_permissions and matches include this host, then reload the extension.`
                    }));
                }
                return;
            }

            // If the content script isn't ready, inject it
            if (msg.includes("Could not establish connection") || msg.includes("Receiving end does not exist")) {
                console.log("Injecting script into tab", tab.id);
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });
                // Wait a bit for the script to initialize
                await new Promise(r => setTimeout(r, 1000));
                await trySend();
            } else {
                throw err;
            }
        }
    } catch (error) {
        console.error("Error processing prompt:", error);
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: "status",
                requestId: requestId,
                status: `Error: ${error.message}`
            }));
        }
    }
}

connect();
