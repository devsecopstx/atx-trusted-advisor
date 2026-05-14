#!/usr/bin/env bash
# Regenerate ios/App/.../AppIcon.appiconset from assets/icon-only.png (single source of truth).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${ROOT}/assets/icon-only.png"
DST="${ROOT}/ios/App/App/Assets.xcassets/AppIcon.appiconset"
if [[ ! -f "$SRC" ]]; then
  echo "missing: $SRC" >&2
  exit 1
fi
if [[ ! -d "$DST" ]]; then
  echo "missing: $DST" >&2
  exit 1
fi
sips -z 1024 1024 "$SRC" --out "$DST/AppIcon-512@2x.png" >/dev/null
M="$DST/AppIcon-512@2x.png"
sips -z 40 40 "$M" --out "$DST/AppIcon-iphone-20@2x.png" >/dev/null
sips -z 60 60 "$M" --out "$DST/AppIcon-iphone-20@3x.png" >/dev/null
sips -z 58 58 "$M" --out "$DST/AppIcon-iphone-29@2x.png" >/dev/null
sips -z 87 87 "$M" --out "$DST/AppIcon-iphone-29@3x.png" >/dev/null
sips -z 80 80 "$M" --out "$DST/AppIcon-iphone-40@2x.png" >/dev/null
sips -z 120 120 "$M" --out "$DST/AppIcon-iphone-40@3x.png" >/dev/null
sips -z 120 120 "$M" --out "$DST/AppIcon-iphone-60@2x.png" >/dev/null
sips -z 180 180 "$M" --out "$DST/AppIcon-iphone-60@3x.png" >/dev/null
sips -z 20 20 "$M" --out "$DST/AppIcon-ipad-20@1x.png" >/dev/null
sips -z 40 40 "$M" --out "$DST/AppIcon-ipad-20@2x.png" >/dev/null
sips -z 29 29 "$M" --out "$DST/AppIcon-ipad-29@1x.png" >/dev/null
sips -z 58 58 "$M" --out "$DST/AppIcon-ipad-29@2x.png" >/dev/null
sips -z 40 40 "$M" --out "$DST/AppIcon-ipad-40@1x.png" >/dev/null
sips -z 80 80 "$M" --out "$DST/AppIcon-ipad-40@2x.png" >/dev/null
sips -z 76 76 "$M" --out "$DST/AppIcon-ipad-76@1x.png" >/dev/null
sips -z 152 152 "$M" --out "$DST/AppIcon-ipad-76@2x.png" >/dev/null
sips -z 167 167 "$M" --out "$DST/AppIcon-ipad-83.5@2x.png" >/dev/null
echo "ios AppIcon regenerated from $SRC"
