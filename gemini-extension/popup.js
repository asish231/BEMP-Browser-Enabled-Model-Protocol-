document.getElementById('sendBtn').addEventListener('click', async () => {
    const promptText = document.getElementById('promptInput').value;
    const model = document.getElementById('modelSelect').value;
    const statusDiv = document.getElementById('status');

    if (!promptText) {
        statusDiv.textContent = "Please enter a prompt.";
        return;
    }

    statusDiv.textContent = `Sending to ${model}...`;

    const patternMap = {
        gemini: ["https://gemini.google.com/*", "https://*.gemini.google.com/*"],
        chatgpt: ["https://chatgpt.com/*", "https://*.chatgpt.com/*", "https://*.openai.com/*"],
        deepseek: ["https://chat.deepseek.com/*"],
        qwen: ["https://chat.qwen.ai/*"],
        kimi: ["https://www.kimi.com/*", "https://kimi.moonshot.cn/*"],
        venice: ["https://venice.ai/*"],
        blackbox: ["https://www.blackbox.ai/*", "https://blackbox.ai/*"]
    };

    const urlPatterns = patternMap[model] || [];

    try {
        // Search for any open tab for the selected model
        let tabs = [];
        for (const p of urlPatterns) {
            const found = await chrome.tabs.query({ url: p });
            tabs = tabs.concat(found);
        }

        if (tabs.length === 0) {
            statusDiv.textContent = `Error: No ${model} tab open.`;
            return;
        }

        // Pick the first tab found
        const tab = tabs[0];

        try {
            await sendMessageToTab(tab.id, promptText, model);
            statusDiv.textContent = "Prompt sent to background tab!";
        } catch (err) {
            if (err.message.includes("Could not establish connection")) {
                statusDiv.textContent = "Injecting script...";
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });
                // Wait a small amount for script to init
                await new Promise(r => setTimeout(r, 100));
                await sendMessageToTab(tab.id, promptText, model);
                statusDiv.textContent = "Prompt sent to background tab!";
            } else {
                throw err;
            }
        }
    } catch (error) {
        console.error(error);
        statusDiv.textContent = "Error: " + error.message;
    }
});

function sendMessageToTab(tabId, text, model) {
    return chrome.tabs.sendMessage(tabId, {
        action: "sendPrompt",
        text: text,
        model: model
    });
}
