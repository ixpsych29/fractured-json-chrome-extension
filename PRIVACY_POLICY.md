# Privacy Policy — Fractured JSON Formatter

**Effective date:** March 27, 2026  
**Extension name:** Fractured JSON — Formatter  
**Developer:** ixpsych29

---

## Overview

Fractured JSON — Formatter is a Chrome extension that detects and beautifully formats raw JSON content on web pages you visit. This privacy policy explains how the extension handles your data.

## Data Collection

**This extension does NOT collect, store, or transmit any user data to external servers.**

Specifically:

- **No analytics or telemetry** is collected.
- **No personal information** (name, email, browsing history, etc.) is gathered.
- **No network requests** are made to any third-party server.
- **No cookies or tracking** mechanisms are used.

## How Data Is Processed

All JSON formatting and syntax highlighting is performed **locally in your browser**. The extension:

1. Detects pages that serve raw JSON content (based on MIME type and page structure).
2. Parses and reformats the JSON using the [FracturedJson](https://github.com/j-brooke/FracturedJson) library, running entirely within a local Web Worker or the extension's background service worker.
3. Replaces the raw JSON view with a syntax-highlighted, interactive viewer.

**No data ever leaves your device.**

## Permissions Explained

| Permission | Purpose |
|---|---|
| `storage` | Saves your local preferences (theme, format mode, line numbers) across browser sessions. Data is stored locally via `chrome.storage.local` and never transmitted. |
| `host_permissions` (`*://*/*`) | Allows the content script to run on any page so the extension can detect and format JSON responses regardless of the domain. **No data from these pages is collected or sent externally.** |

## Local Storage

The extension uses `chrome.storage.local` to persist the following user preferences:

- Selected theme (Dark / Light / Cobalt)
- Format mode (Pretty-print / Minify / Near-minify)
- Line number visibility toggle
- Auto-format enabled/disabled
- Domain whitelist (user-configured)

This data is stored entirely on your device and is never shared.

## Third-Party Services

This extension does **not** integrate with or send data to any third-party services, APIs, or servers.

## Changes to This Policy

If this privacy policy is updated, the changes will be reflected in the extension's repository and Chrome Web Store listing. The effective date at the top of this document will be updated accordingly.

## Contact

If you have questions or concerns about this privacy policy, please open an issue on the [GitHub repository](https://github.com/ixpsych29/fractured-json-chrome-extension) or contact the developer directly.
