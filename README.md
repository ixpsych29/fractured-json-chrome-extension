# Fractured JSON — Chrome Extension

A Chrome extension port of [FracturedJson](https://github.com/j-brooke/FracturedJson). Automatically detects raw JSON pages (including strict-CSP API endpoints like `api.github.com`) and replaces them with a beautiful, syntax-highlighted, interactive viewer — complete with a browser-window chrome UI.

---

## Features

- 🎨 **Syntax highlighting** — keys, strings, numbers, booleans, punctuation each in distinct colours
- 🖥️ **Browser window chrome** — macOS-style traffic lights + address bar wrapping the viewer
- 📌 **Sticky controls** — toolbar and title bar stay pinned; only the JSON content scrolls
- ⚡ **Three format modes** — Pretty-print, Minify, Near-minify
- 🌗 **Three themes** — Dark, Light, Cobalt
- 🔢 **Line numbers** — toggleable gutter
- 📋 **View raw / Download** — toggle between formatted and raw, or save as `.json`
- 🔒 **Works on strict-CSP pages** — `api.github.com`, `api.*`, and any endpoint with `default-src 'none'` (falls back to the background service worker instead of blocked blob URLs)
- 🏗️ **Worker-based** — formatting runs off the main thread so large payloads never freeze the UI
- 🔄 **Persistent preferences** — theme, mode, and line-number state are saved across tabs

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- Any package manager: **npm**, **pnpm**, **yarn**, or **bun**

### Install dependencies

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn

# bun
bun install
```

### Build

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

The compiled extension is output to the `dist/` folder.

### Development (watch mode)

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

Watches all source files and rebuilds on change. Reload the extension in Chrome after each rebuild.

---

## Loading in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder

---

## Usage

Navigate to any URL that returns raw JSON — the extension auto-detects it and replaces the page with the viewer. Examples to try:

| URL                                          | Notes                                         |
| -------------------------------------------- | --------------------------------------------- |
| `https://dummyjson.com/products`             | Basic test                                    |
| `https://jsonplaceholder.typicode.com/users` | Nested objects                                |
| `https://api.github.com/users`               | Strict CSP — tests background worker fallback |
| `https://api.github.com/emojis`              | Large object                                  |
| `https://restcountries.com/v3.1/all`         | Huge array — stress test                      |
| `https://open.er-api.com/v6/latest/USD`      | Exchange rates                                |

Use the **View raw** button to toggle back to the original text, or **Download** to save the formatted output.

---

## How It Works

### Worker strategy (CSP-aware)

Many API endpoints enforce a strict `Content-Security-Policy: default-src 'none'` header. Blob URLs (used in older fallback approaches) inherit the page's origin and are blocked by this policy. The extension uses a three-tier fallback:

1. **Direct extension Worker** (`chrome-extension://...`) — works on most pages
2. **Background service worker** — used when the page CSP blocks the direct worker (e.g. `api.github.com`)
3. **Inline formatting** — last resort for small payloads when both workers are unavailable

### Chrome JSON viewer detection

Chrome's built-in JSON viewer intercepts API responses and renders them in a custom shadow DOM (`<json-formatter>`). The extension detects this and fetches the raw JSON directly via `fetch(location.href)` as a fallback.

---

## CI & Publishing

A GitHub Actions workflow (`.github/workflows/package.yml`) builds the extension on every push and produces `fracturedjson-chrome.zip` as a downloadable artifact.

**Tagged releases:** pushing a tag starting with `v` (e.g. `v1.0.0`) automatically creates a GitHub Release containing the ZIP.

**Chrome Web Store:** upload the `dist/` folder (or the ZIP) via the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

---

## Project Structure

```
src/
├── contentScript.ts   # Injected into every tab — detects JSON, renders the viewer
├── contentWorker.ts   # Web Worker — runs FracturedJson formatting off the main thread
├── background.ts      # Service worker — CSP fallback for strict-CSP pages
├── styles.css         # All viewer styles (scoped under #fractured-json-page-root)
├── popup.html / .ts   # Extension popup (minimal)
└── worker.ts          # Worker entry shim
manifest.json          # MV3 manifest
dist/                  # Built output (load this folder in Chrome)
```

---

## License

MIT — see [LICENSE](./LICENSE)
