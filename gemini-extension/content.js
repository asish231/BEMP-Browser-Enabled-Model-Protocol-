(() => {
    if (window.hasRun) return;
    window.hasRun = true;

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "sendPrompt") {
            processPrompt(request.text, request.model, request.requestId, request.newChat);
        }
    });

    async function processPrompt(text, model, requestId, newChat) {
        try {
            if (newChat) {
                sendUpdate(requestId, "Starting new chat...");
                await resetByModel(model);
                await new Promise(r => setTimeout(r, 2000));
            }

            await sendByModel(model, text);
            const response = await waitByModel(model, requestId);
            sendBack(requestId, response);
        } catch (err) {
            chrome.runtime.sendMessage({
                action: "promptStatus",
                requestId: requestId,
                status: "Error occurred, using 5s fallback"
            });
            await new Promise(r => setTimeout(r, 5000));
            const fallbackText = scrapeLatestResponseText(model) || ("Error: " + err.message);
            sendBack(requestId, fallbackText);
        }
    }

    async function resetGemini() {
        console.log("Attempting to reset Gemini chat via New Chat button...");
        
        // Target the actual "New chat" button with data-test-id="expanded-button"
        const btn = document.querySelector('button[data-test-id="expanded-button"]');
        
        if (btn) {
            // Remove disabled state (button is disabled due to viewport size)
            btn.removeAttribute("disabled");
            btn.removeAttribute("aria-disabled");
            btn.classList.remove("mdc-list-item--disabled");
            
            console.log("Found New Chat button, using keyboard navigation...");
            // Focus the button and press Enter instead of using .click()
            btn.focus();
            await new Promise(r => setTimeout(r, 100));
            
            const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
            });
            btn.dispatchEvent(enterEvent);
            
            const enterUpEvent = new KeyboardEvent('keyup', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
            });
            btn.dispatchEvent(enterUpEvent);
            
            return;
        }
        
        // Fallback: force navigation to root if button not found
        console.log("New Chat button not found, falling back to root navigation...");
        window.location.href = "https://gemini.google.com";
    }

    async function resetChatGPT() {
        const newChatBtn = document.querySelector('a[href="/"], button[aria-label="New chat"]');
        if (newChatBtn) { newChatBtn.click(); return; }
        window.location.href = "https://chatgpt.com/";
    }

    async function resetDeepSeek() {
        const btn = document.querySelector('a[href="/"], a[href="/chat"]');
        if (btn) { btn.click(); return; }
        window.location.href = "https://chat.deepseek.com/";
    }

    async function resetQwen() {
        const btn = document.querySelector('a[href="/"], a[href*="/chat"]');
        if (btn) { btn.click(); return; }
        window.location.href = "https://chat.qwen.ai/";
    }

    async function resetKimi() {
        const btn = document.querySelector('a[href="/"], a[href*="/chat"]');
        if (btn) { btn.click(); return; }
        window.location.href = "https://www.kimi.com/en/";
    }

    async function resetVenice() {
        const btn = document.querySelector('a[href="/"], a[href*="/chat"]');
        if (btn) { btn.click(); return; }
        window.location.href = "https://venice.ai/chat";
    }

    async function resetBlackbox() {
        const btn = document.querySelector('a[href="/"], a[href*="/chat"]');
        if (btn) { btn.click(); return; }
        window.location.href = "https://www.blackbox.ai/";
    }

    async function resetByModel(model) {
        if (model === 'gemini') return resetGemini();
        if (model === 'chatgpt') return resetChatGPT();
        if (model === 'deepseek') return resetDeepSeek();
        if (model === 'qwen') return resetQwen();
        if (model === 'kimi') return resetKimi();
        if (model === 'venice') return resetVenice();
        if (model === 'blackbox') return resetBlackbox();
        return;
    }

    function sendBack(requestId, text) {
        chrome.runtime.sendMessage({
            action: "promptResponse",
            requestId: requestId,
            text: text
        });
    }

    function sendUpdate(requestId, status) {
        chrome.runtime.sendMessage({
            action: "promptStatus",
            requestId: requestId,
            status: status
        });
    }

    function sendStream(requestId, chunk) {
        chrome.runtime.sendMessage({
            action: "promptStream",
            requestId: requestId,
            chunk: chunk
        });
    }

    function waitForCondition(predicate, timeout) {
        return new Promise((resolve, reject) => {
            // Check immediately first
            try {
                if (predicate()) {
                    resolve(true);
                    return;
                }
            } catch (e) { }

            const start = Date.now();
            const interval = setInterval(() => {
                let ok = false;
                try { ok = !!predicate(); } catch (e) { ok = false; }
                if (ok) {
                    clearInterval(interval);
                    resolve(true);
                } else if (Date.now() - start > timeout) {
                    clearInterval(interval);
                    reject(new Error("Timeout"));
                }
            }, 200);
        });
    }

    async function sendByModel(model, text) {
        if (model === 'gemini') return sendGemini(text);
        if (model === 'chatgpt') return sendChatGPT(text);
        if (model === 'deepseek') return sendDeepSeek(text);
        if (model === 'qwen') return sendQwen(text);
        if (model === 'kimi') return sendKimi(text);
        if (model === 'venice') return sendVenice(text);
        if (model === 'blackbox') return sendBlackbox(text);
        throw new Error('Unknown model: ' + model);
    }

    async function sendGemini(text) {
        const inputSelectors = ['div[contenteditable="true"]', 'div[role="textbox"]', 'rich-textarea div[contenteditable="true"]'];
        let inputField = null;
        for (const selector of inputSelectors) {
            inputField = document.querySelector(selector);
            if (inputField) break;
        }
        if (!inputField) throw new Error("Gemini input not found");

        inputField.focus();
        inputField.innerHTML = "";
        const p = document.createElement('p');
        p.textContent = text;
        inputField.appendChild(p);

        ['input', 'change', 'keyup', 'keydown'].forEach(evt => {
            inputField.dispatchEvent(new Event(evt, { bubbles: true, cancelable: true }));
        });

        await new Promise(r => setTimeout(r, 500));

        const sendButton = document.querySelector('button[aria-label="Send message"], button[aria-label="Send"]');
        if (!sendButton) throw new Error("Gemini send button not found");
        sendButton.click();
    }

    function scrapeLatestResponseText(model) {
        if (model === 'chatgpt') {
            const messages = document.querySelectorAll('.markdown, [data-message-author-role="assistant"]');
            return messages.length ? messages[messages.length - 1].innerText : '';
        }
        if (model === 'deepseek') {
            const blocks = document.querySelectorAll('[data-testid="message-bubble"], .markdown');
            return blocks.length ? blocks[blocks.length - 1].innerText : '';
        }
        if (model === 'qwen') {
            const blocks = document.querySelectorAll('.chat-message, .assistant, .markdown');
            return blocks.length ? blocks[blocks.length - 1].innerText : '';
        }
        if (model === 'kimi') {
            const blocks = document.querySelectorAll('.message-bubble, .assistant, .markdown');
            return blocks.length ? blocks[blocks.length - 1].innerText : '';
        }
        if (model === 'venice') {
            const blocks = document.querySelectorAll('.message.assistant, .markdown');
            return blocks.length ? blocks[blocks.length - 1].innerText : '';
        }
        if (model === 'blackbox') {
            const blocks = document.querySelectorAll('.response, .assistant, .markdown');
            return blocks.length ? blocks[blocks.length - 1].innerText : '';
        }
        const responses = document.querySelectorAll('.model-response-text, model-response, .message-content');
        if (responses.length) return responses[responses.length - 1].innerText;
        const allTextBlocks = document.querySelectorAll('div[data-message-id]');
        if (allTextBlocks.length) return allTextBlocks[allTextBlocks.length - 1].innerText;
        return '';
    }

    async function waitForGeminiResponse(requestId) {
        sendUpdate(requestId, "Thinking...");

        // 1. Wait for Send button to disable (indicating request started)
        try {
            await waitForCondition(() => {
                const sendBtn = document.querySelector('button[aria-label="Send message"], button[aria-label="Send"]');
                return sendBtn && sendBtn.disabled;
            }, 5000);
        } catch (e) {
            console.log("Did not detect send button disable, proceeding to wait for completion...");
        }

        // 2. Wait for Send button to enable (indicating request finished)
        sendUpdate(requestId, "Generating...");
        let lastText = "";

        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                const sendBtn = document.querySelector('button[aria-label="Send message"], button[aria-label="Send"]');
                // The request is done when the send button is visible and NOT disabled
                const isDone = sendBtn && !sendBtn.disabled;

                const currentText = scrapeLatestResponseText('gemini');

                // Stream updates if text is growing
                if (currentText && currentText.length > lastText.length) {
                    const newChunk = currentText.slice(lastText.length);
                    sendStream(requestId, newChunk);
                    lastText = currentText;
                }

                if (isDone) {
                    clearInterval(checkInterval);
                    // Ensure we capture the very last bit of text
                    if (currentText && currentText !== lastText) {
                        sendStream(requestId, currentText.slice(lastText.length));
                    }
                    resolve(currentText || "Error: No text found");
                }
            }, 200); // Check faster (200ms) for smoother streaming

            // Safety timeout (120 seconds as requested)
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve(lastText || "Timeout waiting for response");
            }, 120000);
        });
    }

    async function sendChatGPT(text) {
        const inputField = document.querySelector('#prompt-textarea');
        if (!inputField) throw new Error("ChatGPT input not found");
        inputField.focus();
        inputField.innerHTML = `<p>${text}</p>`;
        inputField.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 500));
        const sendButton = document.querySelector('button[data-testid="send-button"]');
        if (!sendButton) throw new Error("ChatGPT send button not found");
        sendButton.click();
    }

    async function sendDeepSeek(text) {
        const input = document.querySelector('textarea, [contenteditable="true"][role="textbox"]');
        if (!input) throw new Error('DeepSeek input not found');
        if (input.tagName.toLowerCase() === 'textarea') {
            input.value = text;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            input.innerHTML = `<p>${text}</p>`;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        await new Promise(r => setTimeout(r, 300));
        const btn = document.querySelector('button[type="submit"], button[aria-label*="Send"], button:has(svg)');
        if (!btn) throw new Error('DeepSeek send button not found');
        btn.click();
    }

    async function sendQwen(text) {
        const input = document.querySelector('textarea, div[contenteditable="true"][role="textbox"]');
        if (!input) throw new Error('Qwen input not found');
        if (input.tagName.toLowerCase() === 'textarea') {
            input.value = text;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            input.innerHTML = `<p>${text}</p>`;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        await new Promise(r => setTimeout(r, 300));
        const btn = document.querySelector('button[type="submit"], button[aria-label*="Send"], .send-button button');
        if (!btn) throw new Error('Qwen send button not found');
        btn.click();
    }

    async function sendKimi(text) {
        const input = document.querySelector('textarea, div[contenteditable="true"][role="textbox"]');
        if (!input) throw new Error('Kimi input not found');
        if (input.tagName.toLowerCase() === 'textarea') {
            input.value = text;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            input.innerHTML = `<p>${text}</p>`;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        await new Promise(r => setTimeout(r, 300));
        const btn = document.querySelector('button[type="submit"], button[aria-label*="Send"], .send-button button');
        if (!btn) throw new Error('Kimi send button not found');
        btn.click();
    }

    async function sendVenice(text) {
        const input = document.querySelector('textarea, div[contenteditable="true"][role="textbox"]');
        if (!input) throw new Error('Venice input not found');
        if (input.tagName.toLowerCase() === 'textarea') {
            input.value = text;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            input.innerHTML = `<p>${text}</p>`;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        await new Promise(r => setTimeout(r, 300));
        const btn = document.querySelector('button[type="submit"], button[aria-label*="Send"], .send-button button');
        if (!btn) throw new Error('Venice send button not found');
        btn.click();
    }

    async function sendBlackbox(text) {
        const input = document.querySelector('textarea, div[contenteditable="true"][role="textbox"]');
        if (!input) throw new Error('Blackbox input not found');
        if (input.tagName.toLowerCase() === 'textarea') {
            input.value = text;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            input.innerHTML = `<p>${text}</p>`;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        await new Promise(r => setTimeout(r, 300));
        const btn = document.querySelector('button[type="submit"], button[aria-label*="Send"], .send-button button');
        if (!btn) throw new Error('Blackbox send button not found');
        btn.click();
    }

    function waitByModel(model, requestId) {
        if (model === 'gemini') return waitForGeminiResponse(requestId);
        if (model === 'chatgpt') return waitForChatGPTResponse(requestId);
        if (model === 'deepseek') return waitForGenericWait(requestId, 'deepseek');
        if (model === 'qwen') return waitForGenericWait(requestId, 'qwen');
        if (model === 'kimi') return waitForGenericWait(requestId, 'kimi');
        if (model === 'venice') return waitForGenericWait(requestId, 'venice');
        if (model === 'blackbox') return waitForGenericWait(requestId, 'blackbox');
        return Promise.resolve('Unknown model');
    }

    async function waitForChatGPTResponse(requestId) {
        sendUpdate(requestId, "Thinking...");

        let smartMode = false;
        try {
            await waitForCondition(() => {
                return document.querySelector('button[aria-label="Stop generating"]') !== null;
            }, 5000);
            smartMode = true;
        } catch (e) {
            console.log("Smart detection failed, using 5-second fallback");
        }

        if (!smartMode) {
            sendUpdate(requestId, "Waiting 5 seconds for response...");
            await new Promise(r => setTimeout(r, 5000));

            const finalText = scrapeLatestResponseText('chatgpt');
            if (finalText) {
                sendStream(requestId, finalText);
            }
            return finalText || "No response found after 5 seconds";
        }

        sendUpdate(requestId, "Generating...");
        let lastText = "";

        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                const stopBtn = document.querySelector('button[aria-label="Stop generating"]');
                const isDone = !stopBtn;

                const currentText = scrapeLatestResponseText('chatgpt');

                if (currentText && currentText.length > lastText.length) {
                    const newChunk = currentText.slice(lastText.length);
                    sendStream(requestId, newChunk);
                    lastText = currentText;
                }

                if (isDone) {
                    clearInterval(checkInterval);
                    resolve(currentText || "Error: No text found");
                }
            }, 500);

            setTimeout(() => {
                clearInterval(checkInterval);
                resolve(lastText || "Timeout");
            }, 60000);
        });
    }

    async function waitForGenericWait(requestId, model) {
        sendUpdate(requestId, 'Generating...');
        let lastText = '';
        return new Promise((resolve) => {
            const interval = setInterval(() => {
                const text = scrapeLatestResponseText(model);
                if (text && text.length > lastText.length) {
                    const chunk = text.slice(lastText.length);
                    sendStream(requestId, chunk);
                    lastText = text;
                }
            }, 400);
            setTimeout(() => {
                clearInterval(interval);
                const text = scrapeLatestResponseText(model);
                resolve(text || lastText || 'No response found');
            }, 90000);
        });
    }
})();
