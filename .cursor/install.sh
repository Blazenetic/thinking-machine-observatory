#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap for The Thinking Machine Observatory.
# The repository pins Node 24 (.node-version) and pnpm 11 (packageManager),
# so this ensures the pinned Node is active via nvm before installing.
set -euo pipefail

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# Install and activate the repository-pinned Node line. Re-running is a fast no-op.
nvm install 24
nvm use 24
nvm alias default 24 >/dev/null

# The repo pins pnpm@11 through the package.json "packageManager" field.
corepack enable >/dev/null 2>&1 || true

node --version
pnpm --version

pnpm install --frozen-lockfile
