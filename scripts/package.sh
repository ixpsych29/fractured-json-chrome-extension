#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────
# package.sh — Build and package the extension for Chrome Web Store upload
# ──────────────────────────────────────────────────────────────────────────
#
# Usage:
#   chmod +x scripts/package.sh
#   ./scripts/package.sh
#
# Output:
#   fractured-json-extension.zip  (ready for CWS upload)
# ──────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ZIP_NAME="fractured-json-extension.zip"

cd "$ROOT_DIR"

echo "🔨 Building extension…"

# Detect package manager
if command -v pnpm &>/dev/null; then
  pnpm install --frozen-lockfile
  pnpm build
elif command -v npm &>/dev/null; then
  npm ci
  npm run build
elif command -v yarn &>/dev/null; then
  yarn install --frozen-lockfile
  yarn build
elif command -v bun &>/dev/null; then
  bun install
  bun run build
else
  echo "❌ No package manager found (pnpm, npm, yarn, bun)"
  exit 1
fi

echo "✅ Build complete. Contents of dist/:"
ls -lh dist/

# Remove old zip if present
rm -f "$ZIP_NAME"

echo ""
echo "📦 Packaging dist/ → $ZIP_NAME"
echo "   Excluding: node_modules, src, .git, .github, *.map, *.ts"

cd dist
zip -r "../$ZIP_NAME" . \
  -x "*.map" \
  -x "*.ts" \
  -x ".git/*" \
  -x ".github/*" \
  -x "node_modules/*" \
  -x "src/*"
cd ..

echo ""
echo "📋 ZIP contents:"
unzip -l "$ZIP_NAME"

SIZE=$(du -h "$ZIP_NAME" | cut -f1)
echo ""
echo "🎉 Done! $ZIP_NAME ($SIZE)"
echo ""
echo "Next steps:"
echo "  1. Go to https://chrome.google.com/webstore/devconsole"
echo "  2. Click 'New Item' or update your existing listing"
echo "  3. Upload $ZIP_NAME"
echo "  4. Fill in the store listing using CWS_LISTING.txt"
echo "  5. Add PRIVACY_POLICY.md as your privacy policy URL"
