# Fractured JSON — Chrome extension

This is a Chrome extension port of FracturedJson (based on the VSCode plugin). It uses a Web Worker and streaming file reads so very large files don't block the UI.

Features
- Reformat / Minify / Near-minify
- Stream large files into a worker
- Copy or download formatted output

Build & load
1. pnpm install
2. pnpm build
3. Load the `dist/` folder in Chrome (Extensions → Load unpacked)

Auto-tab formatting
- When you open a raw JSON resource in a browser tab the extension will auto-detect and replace the page with a pretty, syntax-coloured view.  Use the "View raw" button to toggle back to the original text.

Notes
- This project bundles `fracturedjsonjs` (the original formatting engine).
- The extension uses a Web Worker to avoid freezing the UI when processing large files.

CI & publishing
- A GitHub Actions workflow is included (`.github/workflows/package.yml`) that builds the extension and produces `fracturedjson-chrome.zip` as a workflow artifact.
- Pushing a git tag that starts with `v` (for example `v0.1.0`) will create a GitHub Release containing the ZIP.

Publishing to Chrome Web Store
- Manual: open the Chrome Web Store Developer Dashboard, create a new item, and upload the `dist/` folder (or the ZIP produced by the GitHub Action).
- Automatic (optional): you can enable CI publishing by creating OAuth credentials and a refresh token for the Chrome Web Store API and then adding a publish step to the workflow (I can add a template if you want).

How to add this repo to GitHub
1. git init
2. git add .
3. git commit -m "chore: initial commit + CI"
4. Create a GitHub repository (on github.com) and add it as a remote, for example:
   - git remote add origin git@github.com:YOUR_USER/fracturedjson-chrome-extension.git
   - git branch -M main
   - git push -u origin main

Licensing
- MIT (see LICENSE)
