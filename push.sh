#!/usr/bin/env bash
# Push this project to https://github.com/msnik/Base2048
# Usage: bash push.sh
set -e
cd "$(dirname "$0")"

REMOTE_URL="https://github.com/msnik/Base2048.git"

# 1. Init if needed
if [ ! -d .git ]; then
  git init
fi

# 2. Stage & commit everything
git add .
if git diff --cached --quiet; then
  echo "→ Nothing new to commit."
else
  git commit -m "Onchain 2048 on Base — Solidity game + ERC-721 trophy + React frontend"
fi

# 3. Make sure we are on 'main'
git branch -M main

# 4. Remote
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi

# 5. Push
echo "→ Pushing to $REMOTE_URL …"
if git push -u origin main; then
  echo "✓ Done — https://github.com/msnik/Base2048"
else
  echo ""
  echo "Push was rejected (the remote probably already has commits)."
  echo "Run:  git pull origin main --rebase && git push -u origin main"
  exit 1
fi
