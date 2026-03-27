# Privacy Policy

**Extension:** Fractured JSON — Formatter  
**Effective date:** March 27, 2026  
**Developer:** ixpsych29

---

## Single-Sentence Summary

**All JSON processing happens locally in your browser. This extension does not collect, store, or transmit any user data to any external server.**

---

## What This Extension Does

Fractured JSON — Formatter detects web pages that contain raw JSON and replaces them with a formatted, syntax-highlighted viewer. The entire process — detection, parsing, formatting, and rendering — runs **100% locally** inside your browser using a Web Worker and the extension's service worker. No data is sent anywhere.

## Data Collection

This extension collects **zero** user data. Specifically:

| Category | Collected? | Details |
|---|---|---|
| Personal information | ❌ No | No names, emails, accounts, or identifiers are accessed |
| Browsing history | ❌ No | The extension does not record which pages you visit |
| Page content | ❌ No | JSON is read from the page DOM and processed in-memory only; it is never stored or transmitted |
| Analytics / telemetry | ❌ No | No usage tracking, crash reporting, or event logging of any kind |
| Cookies / tracking | ❌ No | No cookies are set and no tracking mechanisms are used |
| Network requests to third parties | ❌ No | The extension makes **zero** outbound network requests |

## How JSON Processing Works

1. The content script checks whether the current page contains raw JSON (by inspecting the MIME type and DOM structure).
2. If the page is **not** JSON, the script exits immediately with no further action.
3. If JSON is detected, it is read from the page's existing DOM text (or re-fetched from the same URL when Chrome's built-in viewer obscures it).
4. The JSON is formatted using the FracturedJson library, running inside a local Web Worker (or the extension's background service worker as a fallback).
5. The formatted output is rendered directly into the page. **At no point does the JSON leave the browser.**

## Permissions Explained

| Permission | Why It's Needed |
|---|---|
| **`storage`** | Persists your local preferences (theme, format mode, line-number toggle) across sessions via `chrome.storage.local`. This data stays on your device and is never transmitted. |
| **`host_permissions: *://*/*`** | Required so the content script can run on any page to detect JSON responses. JSON APIs exist on arbitrary domains, so the extension needs broad host access. **No data from these pages is collected or sent externally.** The content script performs a lightweight check and exits immediately on non-JSON pages. |

## Local Storage Details

The extension stores the following preferences locally via `chrome.storage.local`:

- Theme selection (Dark / Light / Cobalt)
- Format mode (Pretty-print / Minify / Near-minify)
- Line-number visibility
- Auto-format toggle
- Domain whitelist

All preferences are stored entirely on your device and are never shared or transmitted.

## Third-Party Services

This extension does **not** use, integrate with, or communicate with any third-party services, APIs, analytics platforms, or remote servers.

## Remote Code

This extension does **not** execute any remotely-hosted code. All JavaScript is bundled at build time and included in the extension package.

## Changes to This Policy

Updates to this policy will be reflected in the extension's GitHub repository and Chrome Web Store listing. The effective date above will be updated accordingly.

## Contact

For questions or concerns about this privacy policy, please open an issue at:  
**https://github.com/ixpsych29/fractured-json-chrome-extension/issues**
