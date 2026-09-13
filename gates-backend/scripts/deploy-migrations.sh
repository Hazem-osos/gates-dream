#!/usr/bin/env bash
# Run in production after new release: applies Prisma migrations only (no dev prompts).
set -euo pipefail
cd "$(dirname "$0")/.."
export NODE_ENV="${NODE_ENV:-production}"
npm run prisma:generate
npm run prisma:deploy
echo "Migrations applied successfully."
