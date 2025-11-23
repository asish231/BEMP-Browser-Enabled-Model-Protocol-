# BEMP

This is a Chrome extension that allows you to send prompts to various AI web interfaces using DOM manipulation.

## Supported AI Models

- **Gemini** (Google)
- **ChatGPT** (OpenAI)
- **DeepSeek**(best for code)
- **Qwen** (Alibaba Cloud)
- **Kimi** (Moonshot AI)
- **Venice**(uncensored)
- **Blackbox**(coder)

## Installation

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked**.
4. Select the `gemini-extension` folder in this directory (`c:\Users\Win10\Documents\projectbep\gemini-extension`).

## Usage

1. Navigate to [Gemini](https://gemini.google.com) or a specific chat URL like `https://gemini.google.com/app/chat_id`.
2. Click the extension icon in the Chrome toolbar.
3. Enter your prompt in the text area.
4. Click **Send Prompt**.

## Troubleshooting

- If the prompt doesn't send, the DOM selectors might need updating if Google changes the website structure.
- Check the console (Right-click popup -> Inspect, or F12 on the page) for errors.
