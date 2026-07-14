#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[codex-worktree-setup] %s\n' "$*"
}

require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    log "$command_name が見つかりません。インストールしてから再実行してください。"
    exit 1
  fi
}

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$repo_root"

require_command python3
require_command node

log "Repository: $repo_root"
log "Python: $(python3 --version 2>&1)"
log "Node: $(node --version 2>&1)"
log "依存関係のインストールや静的サーバーの起動は行いません。"
log "Claude Code / Codex のMCP設定を同期します。"
node .agent-shared/scripts/sync-agent-mcp.mjs
log "セットアップが完了しました。"
