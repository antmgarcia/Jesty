#!/usr/bin/env bash
# Build a clean .zip for Chrome Web Store upload.
# Run from inside "0. Source/":  ./build-zip.sh

set -euo pipefail

cd "$(dirname "$0")"

VERSION=$(grep -E '"version"[[:space:]]*:' manifest.json | head -1 | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')
OUT="../jesty-${VERSION}.zip"

rm -f "$OUT"

zip -r "$OUT" . \
  -x ".git/*" \
  -x ".gitignore" \
  -x "CLAUDE.md" \
  -x ".claude/*" \
  -x ".ui-fullflow/*" \
  -x "design-lab/*" \
  -x "hero-demo.html" \
  -x "character-sheet.html" \
  -x "calendar.js" \
  -x "config.example.js" \
  -x "build-zip.sh" \
  -x ".DS_Store" \
  -x "*/.DS_Store" \
  -x "*.zip"

echo ""
echo "Built: $OUT"
echo ""
echo "Contents:"
unzip -l "$OUT" | tail -20

echo ""
echo "Sanity check — these should NOT appear above:"
echo "  CLAUDE.md, .claude/, .ui-fullflow/, hero-demo.html, character-sheet.html, calendar.js, .DS_Store"
