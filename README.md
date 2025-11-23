# BEMP – Browser Enabled Model Protocol

██████╗ ███████╗███╗   ███╗██████╗ 
██╔══██╗██╔════╝████╗ ████║██╔══██╗
██████╔╝█████╗  ██╔████╔██║██████╔╝
██╔══██╗██╔══╝  ██║╚██╔╝██║██╔═══╝ 
██████╔╝███████╗██║ ╚═╝ ██║██║     
╚═════╝ ╚══════╝╚═╝     ╚═╝╚═╝
A creation by **Asish Kumar Sharma**  
Developed under **SafarNow innovation and production initiatives**  

---

## What is this project?

**BEMP (Browser Enabled Model Protocol)** is a local, open-source bridge that turns *web-based AI interfaces* (Gemini, ChatGPT, DeepSeek, Qwen, Kimi, Venice, Blackbox, and others) into an **API-like protocol** you can call from your own code.

Instead of using official model APIs and burning through API credits or requiring API keys, BEMP drives the **browser UI** via a Chrome extension and exposes a simple streaming interface over HTTP/WebSocket. From your application’s perspective, it looks and feels like talking to a normal AI HTTP API.

You can:
- Prototype **agentic / generative AI systems** without needing API keys.
- Test **multi-model integrations** against the actual web apps.
- Build **local tools and workflows** that use AI models you already have access to via web subscriptions.

BEMP does **not** replace official APIs for production-grade, large-scale workloads, but it gives you a powerful, practical alternative when you:
- Have web access and subscriptions (e.g., **Google One AI Premium / Pro**, **ChatGPT Plus / Go**),
- but **do not** have API access or want to avoid API credit burn.


## Why was it made? (Origin story)

This project was born from a very concrete pain point:

> *“I had access to powerful AI models via the web – through subscriptions like Google Pro and ChatGPT Go – but I **did not** have API keys. I could use the chat interfaces in the browser, sometimes with generous or even unlimited usage, but I couldn’t integrate them into code without paying for or getting access to separate API plans.*

This meant:
- No straightforward way to use these models in **agentic projects**, tools, or backends.
- Risk of **API credit loss** if APIs were used carelessly.
- A feeling that there was an unnecessary wall between **web usage** and **programmatic usage**.

**BEMP is the answer to that problem.**

It uses what you already have – browser access – and builds a **protocol** on top of it so your applications can:
- Send prompts programmatically,
- Receive streaming responses,
- Route requests across different web-based AIs,
- Without needing API keys or worrying about direct API credit burn.

This is intended as a **game changer** for:
- Builders who want to experiment with agentic systems,
- People without enterprise API budgets,
- Anyone who wants to embrace AI without always thinking first about monetary constraints.


## How is it built?

BEMP has three main parts:

1. **Chrome Extension (`gemini-extension/`)**
   - Injects a content script into AI provider pages (Gemini, ChatGPT, DeepSeek, Qwen, Kimi, Venice, Blackbox, etc.).
   - Automates the web UI: fills in the prompt field, presses send, waits for the response, and scrapes the response text.
   - Communicates with a background script that connects to the local bridge over WebSockets.

2. **Bridge Server (multiple language implementations)**
   - Listens on:
     - WebSocket: `ws://localhost:8765/ws`
     - HTTP: `POST http://localhost:8765/send`
   - Accepts a simple JSON payload:
     ```json
     {
       "model": "gemini",        // or chatgpt, deepseek, qwen, kimi, venice, blackbox
       "prompt": "Your prompt",
       "new_chat": false          // optional, true to reset conversation
     }
     ```
   - Forwards a command to the extension over WebSocket: `action = "sendPrompt"`.
   - Streams back NDJSON lines:
     - `{"type":"status","text":"..."}`
     - `{"type":"chunk","text":"..."}`
     - `{"type":"done","text":"..."}`

   A reference implementation exists in Python:
   - **`bridge_server.py`** – original FastAPI-based bridge.

   There are also prototypes in other languages under **`bridge_servers/`**:
   - `bridge_servers/nodejs/server.js` – Node.js (JavaScript)
   - `bridge_servers/nodets/server.ts` – Node.js (TypeScript)
   - `bridge_servers/go/main.go` – Go
   - `bridge_servers/rust/src/main.rs` – Rust
   - `bridge_servers/php/server.php` – PHP (Swoole)
   - `bridge_servers/java/src/main/java/BridgeServer.java` – Java (prototype, not fully aligned to `/ws` path yet)
   - `bridge_servers/cpp/README.txt` – guidance for a C++ implementation

3. **Your Client / Tooling**
   - Any program that can call HTTP and read NDJSON.
   - Example client: **`test_protocol.py`** – a Python script that posts to `/send` and prints streaming output.
   - Additional protocol details: **`PROTOCOL_DOCS.md`** – specification plus examples in multiple languages (Python, JS, Go, C++, Java, TS, PHP, Rust, C).


## Files to look at first

- **`README.md` (this file)** – high-level overview and intent.
- **`PROTOCOL_DOCS.md`** – detailed protocol spec and client examples.
- **`SERVER_DEPLOYMENT_AND_USAGE.md`** – production-style guide for running the bridge in different languages.
- **`bridge_server.py`** – original Python bridge implementation.
- **`gemini-extension/`** – Chrome extension that automates the web UIs.
- **`test_protocol.py`** – quick test script to send prompts.


## Is this production-ready?

This project is **experimental** and still under active development.

- It is very useful for **prototyping**, **testing integrations**, and **small internal tools**.
- It depends on browser automation and DOM selectors, which can break if providers change their UI.
- It is not a drop-in replacement for official APIs when you need long-term stability, SLAs, or large-scale production.

Think of it as a **powerful, open, hackable bridge** for:
- Agentic experiments
- Local tooling
- Learning and exploration

…and not as a fully hardened enterprise product (yet).


## How to use BEMP (high-level)

### 1. Install and load the Chrome extension

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select the `gemini-extension` folder from this repository.

This loads the extension that will automate the AI web UIs.

### 2. Open provider tabs

Open tabs for the providers you intend to use and log in via the browser:
- Gemini: https://gemini.google.com
- ChatGPT: https://chatgpt.com
- DeepSeek: https://chat.deepseek.com
- Qwen: https://chat.qwen.ai
- Kimi: https://www.kimi.com/en (or kimi.moonshot.cn)
- Venice: https://venice.ai/chat
- Blackbox: https://www.blackbox.ai

### 3. Run a bridge server

Pick a language stack and run **one** bridge server on `localhost:8765`. Common choices:

**Python (original)**
- Requires Python 3 and `fastapi`, `uvicorn`, `pydantic`, `requests`.
- Example:
  ```bash
  python bridge_server.py
  ```

**Node.js / Go / Rust / PHP / Java**
- See **`SERVER_DEPLOYMENT_AND_USAGE.md`** for precise commands for each implementation.
- All of them must:
  - expose a **WebSocket** at `ws://localhost:8765/ws`, and
  - expose `POST /send` for HTTP.

### 4. Confirm the extension is connected

- Open the extension background logs (Chrome devtools for the extension).
- You should see a log like: `Connected to Bridge Server`.

### 5. Send a prompt via the protocol

**Using the test script**
- Run:
  ```bash
  python test_protocol.py
  ```
- It will send a test prompt (currently to Gemini) and stream the result.

**Using curl**
```bash
curl -N -H "Content-Type: application/json" \
  -d '{"model":"gemini","prompt":"Say hello from BEMP","new_chat":true}' \
  http://localhost:8765/send
```

You should see NDJSON lines:
```json
{"type":"status","text":"Request queued"}
{"type":"chunk","text":"Hello"}
{"type":"chunk","text":", world"}
{"type":"done","text":"Hello, world!"}
```

Your client can concatenate `chunk` values until you receive `type = "done"`.

### 6. Integrate into your own projects

- Use **`PROTOCOL_DOCS.md`** for example client code in multiple languages.
- Treat BEMP like a local LLM API:
  - send prompts via HTTP,
  - stream results,
  - route to different models via the `model` field.
- Build agent-like logic (tools, chains, planners) on top of this interface.


## Is it enough for a “production launch”? (Honest view)

- For **personal use, hacking, internal tools, demos, and PoCs**: yes, it is already very valuable.
- For **serious, user-facing production** with SLAs, compliance, and scale: treat this as a component that still needs:
  - selector hardening and monitoring for provider UI changes,
  - better error handling, logging, and metrics,
  - authentication and access control around the bridge,
  - a story for horizontal scaling (multiple browsers, multiple machines).

The intent is to **unlock possibilities** and **make AI accessible** even when official API routes are blocked or costly – not to guarantee enterprise-grade uptime out of the box.


## Open source, contributions, and vision

This project is **open source**.

- Anyone can **use it**, **fork it**, **contribute**, and **extend it**.
- You can add support for more providers, more languages, better routing, or richer agent frameworks on top.
- The long-term vision is a world where:
  - People can meaningfully **embrace AI**,
  - without being blocked by **money constraints** or **API gating**,
  - and where the browser itself becomes a powerful, programmable AI surface.

If you have ideas to **increase its capacity** and push it to a whole new level, you’re welcome to do so.


## Credits and contact

- Project name: **BEMP – Browser Enabled Model Protocol**
- Creator: **Asish Kumar Sharma**
- Initiative: **SafarNow innovation and production initiatives**

You are encouraged to:
- Check out **SafarNow** and **Asish Sharma** on LinkedIn.
- Reach out for help, collaboration, or contributions at:
  - **Email:** `asishkksharma@gmail.com`


## Disclaimer

- This project is a **temporary / experimental solution** and is still under active development.
- It uses browser automation against third-party web interfaces; those UIs can change at any time and may break selectors.
- There is **no guarantee** of correctness, uptime, or safety.
- **Any issues, mishaps, or unintended consequences** resulting from the use of this protocol are **not the responsibility of the creators, contributors, or SafarNow**.
- You are solely responsible for:
  - Ensuring that your usage complies with each provider’s **Terms of Service**,
  - Operating it in line with your own **security**, **privacy**, and **compliance** requirements.

By using BEMP, you accept these limitations and responsibilities.

Thank you for exploring this project.

**Code. Build. And if this helps you, don’t hesitate to reach out.**

## License

This project is licensed under the **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)** license.

You are free to:
- **Share** — copy and redistribute the material in any medium or format.
- **Adapt** — remix, transform, and build upon the material.

Under the following terms:
- **Attribution** — You must give appropriate credit, provide a link to the license, and indicate if changes were made.
- **NonCommercial** — You may not use the material for commercial purposes.
- **ShareAlike** — If you remix, transform, or build upon the material, you must distribute your contributions under the same license as the original.

See the [LICENSE](LICENSE) file for details.
