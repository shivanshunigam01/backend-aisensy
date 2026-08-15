#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/backend}"
BRANCH="${BRANCH:-master}"
PM2_NAME="${PM2_NAME:-backend-api}"

cd "$APP_DIR"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"
npm ci --omit=dev
pm2 restart "$PM2_NAME"
pm2 save
echo "Backend deployed from $(git rev-parse --short HEAD) at $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
