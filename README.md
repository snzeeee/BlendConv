# BlendConv

Chrome extension to capture and merge AI conversations across ChatGPT and Claude.

## Features

- **Capture conversations** from ChatGPT and Claude with a floating button
- **Store locally** using `chrome.storage.local` — no data leaves your browser
- **Merge multiple conversations** into a structured prompt
- **Copy or open** the merged prompt in a new ChatGPT/Claude tab

## Installation

1. Clone this repository
2. Open `chrome://extensions/` in Chrome
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the `BlendConv` folder

## Usage

1. Visit [chatgpt.com](https://chatgpt.com) or [claude.ai](https://claude.ai)
2. Click the floating BlendConv button (bottom right) to capture the current conversation
3. Click the BlendConv extension icon to open the popup
4. Select conversations you want to merge
5. Click "Merge" to generate a combined prompt
6. Copy the prompt or open it in a new tab

## Structure

```
BlendConv/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content-scripts/
│   ├── chatgpt.js
│   └── claude.js
├── background/
│   └── service-worker.js
├── utils/
│   ├── extractor.js
│   ├── merger.js
│   └── formatter.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Tech

- Manifest V3
- 100% local — no backend, no API calls
- `chrome.storage.local` for persistence

## License

MIT
