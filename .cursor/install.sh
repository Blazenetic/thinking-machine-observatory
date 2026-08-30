#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap for The Thinking Machine Observatory.
# The repository pins Node 24 (.node-version) and pnpm 11 (packageManager),
# so this ensures the pinned Node is active before installing dependencies.
set -euo pipefail

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# Install and activate the repository-pinned Node line. Re-running is a fast no-op.
nvm install 24
nvm use 24
nvm alias default 24 >/dev/null

# The base image ships a Node 22 shim early on PATH (/exec-daemon/node) that
# would otherwise shadow nvm in the agent's own shells. Append a guarded hook to
# ~/.bashrc so every interactive/login shell prepends the pinned Node 24 bin to
# the front of PATH. ~/.bashrc runs after the base PATH is set, so this wins.
BASHRC="$HOME/.bashrc"
MARKER="observatory-node24"
if [ -f "$BASHRC" ] && ! grep -q "$MARKER" "$BASHRC"; then
  cat >>"$BASHRC" <<'EOF'

# >>> observatory-node24 (managed by .cursor/install.sh) >>>
if command -v nvm >/dev/null 2>&1; then
  __obs_node_dir="$(dirname "$(nvm which default 2>/dev/null)" 2>/dev/null)"
  if [ -n "$__obs_node_dir" ] && [ -x "$__obs_node_dir/node" ]; then
    case ":$PATH:" in
      "$__obs_node_dir:"*) : ;;
      *) PATH="$__obs_node_dir:$PATH"; export PATH ;;
    esac
  fi
  unset __obs_node_dir
fi
# <<< observatory-node24 <<<
EOF
fi

# The repo pins pnpm@11 through the package.json "packageManager" field.
corepack enable >/dev/null 2>&1 || true

node --version
pnpm --version

pnpm install --frozen-lockfile
