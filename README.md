<p align="center">
  <img src="icons/icon128.png" alt="BlendConv" width="80">
</p>

<h1 align="center">BlendConv</h1>

<p align="center">
  <strong>Capture and merge your AI conversations across ChatGPT and Claude.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/manifest-v3-blue?style=flat-square" alt="Manifest V3">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/privacy-100%25%20local-purple?style=flat-square" alt="Privacy">
</p>

---

## What is BlendConv?

BlendConv is a Chrome extension that lets you **capture** conversations from ChatGPT and Claude, then **merge** them into a single structured Markdown prompt — so you can seamlessly continue your work across AI platforms.

No backend. No API calls. Everything stays in your browser.

## Features

- **Capture** — A floating button on ChatGPT and Claude captures the current conversation with one click
- **Organize** — View all captured conversations in a clean, dark popup with platform badges and metadata
- **Merge** — Select 2+ conversations and generate a structured Markdown prompt combining all context
- **Export** — Copy the merged result to clipboard, or open it directly in a new ChatGPT/Claude tab

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/snzeeee/BlendConv.git
   ```
2. Open **chrome://extensions/** in Chrome
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked** and select the `BlendConv` folder
5. Done — the BlendConv icon appears in your toolbar

## How it works

1. Visit [chatgpt.com](https://chatgpt.com) or [claude.ai](https://claude.ai)
2. Click the floating **BlendConv button** (bottom-right corner) to capture the conversation
3. Click the **extension icon** in the toolbar to open the popup
4. **Check** the conversations you want to merge
5. Click **Merge** to generate the combined context
6. **Copy** the prompt or open it in a new tab

## Privacy

**100% local. Zero data collection.**

- All data is stored locally in your browser via `chrome.storage.local`
- No external servers, no analytics, no tracking
- No API calls — the extension works entirely offline
- Your conversations never leave your device

## Tech Stack

- Chrome Extension Manifest V3
- Vanilla JavaScript (no frameworks, no build step)
- `chrome.storage.local` for persistence
- DOM extraction with multiple fallback selectors + MutationObserver

## Roadmap

- [ ] Image and file attachment support in captured conversations
- [ ] Google Gemini support
- [ ] AI-powered conversation summaries before merging
- [ ] Export to Markdown / PDF files
- [ ] Conversation search and tagging
- [ ] Firefox extension support

## License

[MIT](LICENSE) — Made by [snzeeee](https://github.com/snzeeee)
