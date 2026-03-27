#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────
# export-icons.sh — Convert icon-128.svg to 24-bit PNGs (no alpha) for CWS
# ──────────────────────────────────────────────────────────────────────────
#
# Prerequisites:
#   • Inkscape (recommended) — OR —
#   • ImageMagick (convert / magick)
#   • rsvg-convert (librsvg2-bin)
#
# Usage:
#   chmod +x scripts/export-icons.sh
#   ./scripts/export-icons.sh
#
# Output:
#   logo-16.png   (16×16,  24-bit RGB, no alpha)
#   logo-48.png   (48×48,  24-bit RGB, no alpha)
#   logo-128.png  (128×128, 24-bit RGB, no alpha)
# ──────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

SVG="$ROOT_DIR/icon-128.svg"
SIZES=(16 48 128)

# Background colour to composite against (replaces transparency).
# Match the SVG's rounded-rect fill colour for a seamless look.
BG_COLOR="#1E1E2E"

if [ ! -f "$SVG" ]; then
  echo "❌ SVG not found: $SVG"
  exit 1
fi

echo "🖼  Exporting icons from: $SVG"

# ── Try rsvg-convert first (fastest, no GUI deps) ───────────────────────
if command -v rsvg-convert &>/dev/null; then
  echo "   Using rsvg-convert"
  for S in "${SIZES[@]}"; do
    OUT="$ROOT_DIR/logo-${S}.png"
    # rsvg-convert exports with alpha; flatten with ImageMagick if available
    rsvg-convert -w "$S" -h "$S" "$SVG" -o "/tmp/fj-icon-${S}.png"
    if command -v convert &>/dev/null; then
      convert "/tmp/fj-icon-${S}.png" -background "$BG_COLOR" -flatten -type TrueColor "$OUT"
    elif command -v magick &>/dev/null; then
      magick "/tmp/fj-icon-${S}.png" -background "$BG_COLOR" -flatten -type TrueColor "$OUT"
    else
      # Fallback: keep the rsvg output (with alpha) if magick isn't available
      cp "/tmp/fj-icon-${S}.png" "$OUT"
      echo "   ⚠ ImageMagick not found — $OUT may still have alpha channel"
    fi
    rm -f "/tmp/fj-icon-${S}.png"
    echo "   ✅ ${S}×${S} → $OUT"
  done
  echo "🎉 Done!"
  exit 0
fi

# ── Try Inkscape ─────────────────────────────────────────────────────────
if command -v inkscape &>/dev/null; then
  echo "   Using Inkscape"
  for S in "${SIZES[@]}"; do
    OUT="$ROOT_DIR/logo-${S}.png"
    inkscape "$SVG" --export-type=png --export-filename="/tmp/fj-icon-${S}.png" \
      --export-width="$S" --export-height="$S" --export-background="$BG_COLOR" \
      --export-background-opacity=1.0 2>/dev/null
    # Ensure 24-bit (no alpha) via ImageMagick if available
    if command -v convert &>/dev/null; then
      convert "/tmp/fj-icon-${S}.png" -type TrueColor "$OUT"
    elif command -v magick &>/dev/null; then
      magick "/tmp/fj-icon-${S}.png" -type TrueColor "$OUT"
    else
      cp "/tmp/fj-icon-${S}.png" "$OUT"
    fi
    rm -f "/tmp/fj-icon-${S}.png"
    echo "   ✅ ${S}×${S} → $OUT"
  done
  echo "🎉 Done!"
  exit 0
fi

# ── Try ImageMagick alone ────────────────────────────────────────────────
if command -v convert &>/dev/null || command -v magick &>/dev/null; then
  CMD="convert"
  command -v magick &>/dev/null && CMD="magick"
  echo "   Using ImageMagick ($CMD)"
  for S in "${SIZES[@]}"; do
    OUT="$ROOT_DIR/logo-${S}.png"
    $CMD -background "$BG_COLOR" -density 300 "$SVG" -resize "${S}x${S}" \
      -flatten -type TrueColor "$OUT"
    echo "   ✅ ${S}×${S} → $OUT"
  done
  echo "🎉 Done!"
  exit 0
fi

echo "❌ No SVG renderer found. Install one of:"
echo "   • rsvg-convert  (sudo apt install librsvg2-bin)"
echo "   • Inkscape       (sudo apt install inkscape)"
echo "   • ImageMagick    (sudo apt install imagemagick)"
exit 1
