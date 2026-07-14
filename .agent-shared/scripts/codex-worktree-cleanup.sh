#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[codex-worktree-cleanup] %s\n' "$*"
}

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
repo_root="$(cd "$repo_root" && pwd -P)"
state_dir="$repo_root/.codex/.runtime"
pid_file="$state_dir/http-server.pid"

cd "$repo_root"
log "Repository: $repo_root"

if [ ! -f "$pid_file" ]; then
  log "追跡中の静的サーバーはありません。"
  exit 0
fi

server_pid="$(tr -d '[:space:]' < "$pid_file")"
if ! [[ "$server_pid" =~ ^[0-9]+$ ]]; then
  log "PIDファイルが不正なため削除します。"
  rm -f "$pid_file"
  exit 0
fi

if ! kill -0 "$server_pid" 2>/dev/null; then
  log "追跡中の静的サーバーは既に終了しています。"
  rm -f "$pid_file"
  rmdir "$state_dir" 2>/dev/null || true
  exit 0
fi

if ! command -v ps >/dev/null 2>&1 || ! command -v lsof >/dev/null 2>&1; then
  log "プロセス所有者を確認できないため停止しません。"
  exit 0
fi

command_line="$(ps -p "$server_pid" -o command= 2>/dev/null || true)"
if [[ "$command_line" != *" -m http.server "* ]]; then
  log "対象プロセスは静的サーバーではありません。停止しません。"
  rm -f "$pid_file"
  exit 0
fi

process_cwd="$(lsof -a -p "$server_pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1)"
if [ "$process_cwd" != "$repo_root" ]; then
  log "対象サーバーは別のディレクトリで起動されています。停止しません。"
  rm -f "$pid_file"
  exit 0
fi

log "このworktreeの静的サーバーを停止します: PID $server_pid"
kill "$server_pid"

for _ in {1..50}; do
  if ! kill -0 "$server_pid" 2>/dev/null; then
    rm -f "$pid_file"
    rmdir "$state_dir" 2>/dev/null || true
    log "静的サーバーを停止しました。"
    exit 0
  fi
  sleep 0.1
done

log "静的サーバーが5秒以内に終了しませんでした。強制停止は行いません。"
exit 1
