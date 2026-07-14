#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[codex-worktree-up] %s\n' "$*"
}

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
state_dir="$repo_root/.codex/.runtime"
pid_file="$state_dir/http-server.pid"
port="${GENERATOR_PORT:-8000}"
server_pid=""
stop_requested=0

if ! [[ "$port" =~ ^[0-9]+$ ]] || [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
  log "GENERATOR_PORT には1から65535の整数を指定してください: $port"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  log "python3 が見つかりません。"
  exit 1
fi

mkdir -p "$state_dir"

if [ -f "$pid_file" ]; then
  tracked_pid="$(tr -d '[:space:]' < "$pid_file")"
  if [[ "$tracked_pid" =~ ^[0-9]+$ ]] && kill -0 "$tracked_pid" 2>/dev/null; then
    log "静的サーバーは既に起動しています: PID $tracked_pid"
    exit 1
  fi
  rm -f "$pid_file"
fi

# shellcheck disable=SC2329  # Invoked by the INT/TERM trap below.
forward_signal() {
  stop_requested=1
  if [ -n "$server_pid" ] && kill -0 "$server_pid" 2>/dev/null; then
    kill "$server_pid" 2>/dev/null || true
  fi
}

# shellcheck disable=SC2329  # Invoked by the EXIT trap below.
remove_pid_file() {
  if [ -f "$pid_file" ] && [ "$(tr -d '[:space:]' < "$pid_file")" = "$server_pid" ]; then
    rm -f "$pid_file"
    rmdir "$state_dir" 2>/dev/null || true
  fi
}

trap forward_signal INT TERM
trap remove_pid_file EXIT

cd "$repo_root"
log "http://127.0.0.1:$port/ で静的サーバーを起動します。"
python3 -m http.server "$port" --bind 127.0.0.1 &
server_pid=$!
printf '%s\n' "$server_pid" > "$pid_file"

set +e
wait "$server_pid"
server_status=$?
set -e

if [ "$stop_requested" -eq 1 ] || [ "$server_status" -eq 130 ] || [ "$server_status" -eq 143 ]; then
  exit 0
fi
exit "$server_status"
