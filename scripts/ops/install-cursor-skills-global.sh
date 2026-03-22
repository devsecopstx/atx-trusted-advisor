#!/usr/bin/env bash
# Copy repo-local Cursor skills/rules to user's ~/.cursor for global visibility.
# Source of truth remains repo-local; prefer not to edit globals.
set -euo pipefail
SRC_DIR=".cursor"
DEST_DIR="$HOME/.cursor"
mkdir -p "$DEST_DIR"
rsync -av --delete --exclude 'worktrees.json' "$SRC_DIR/skills/" "$DEST_DIR/skills/"
if [ -d "$SRC_DIR/rules" ]; then
  mkdir -p "$DEST_DIR/rules"
  rsync -av --delete "$SRC_DIR/rules/" "$DEST_DIR/rules/"
fi
echo "Installed skills to $DEST_DIR/skills and rules to $DEST_DIR/rules (if present)."