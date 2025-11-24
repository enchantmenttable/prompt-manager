# Prompt Manager Chrome Extension Template

This is a lightweight Manifest V3 template that includes a popup, background service worker, and options page. Use it as a starting point for building prompt management tooling or any other extension ideas.

## Getting Started

1. Open `chrome://extensions` in Chrome, enable **Developer mode**, and click **Load unpacked**.
2. Select this project directory.
3. The popup lets you type a quick prompt note that is persisted via `chrome.storage.local`.

## Files

- `manifest.json` – core MV3 configuration with popup, background worker, and options page.
- `html/` – contains `popup.html` and `options.html` UIs.
- `css/` – popup styling (`popup.css`).
- `js/` – popup logic (`popup.js`) and background service worker (`background.js`).

## Customization Tips

- Replace the placeholder icons referenced in `manifest.json` with real assets under `icons/`.
- Add additional permissions (`tabs`, `scripting`, etc.) when you expand functionality.
- Convert the popup to a bundler setup (React/Vite/etc.) if you need a more complex UI.
