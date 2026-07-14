#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
up_script="$script_dir/codex-worktree-up.sh"
cleanup_script="$script_dir/codex-worktree-cleanup.sh"

assert_contains() {
  local file="$1"
  local expected="$2"
  grep -Fq "$expected" "$file" || {
    printf 'Expected to find: %s\n' "$expected" >&2
    cat "$file" >&2
    return 1
  }
}

free_port() {
  python3 - <<'PY'
import socket
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    print(sock.getsockname()[1])
PY
}

prepare_repo() {
  local repo="$1"
  mkdir -p "$repo/.agent-shared/scripts" "$repo/.codex/.runtime"
  cp "$up_script" "$cleanup_script" "$repo/.agent-shared/scripts/"
  printf '<!doctype html><title>generator test</title>\n' > "$repo/index.html"
  git -C "$repo" init -q
}

wait_for_file() {
  local file="$1"
  for _ in {1..100}; do
    [ -s "$file" ] && return 0
    sleep 0.05
  done
  return 1
}

test_no_running_server_is_a_noop() {
  local tmp_dir repo log
  tmp_dir="$(mktemp -d)"
  repo="$tmp_dir/repo"
  log="$tmp_dir/cleanup.log"
  prepare_repo "$repo"

  (cd "$repo" && bash .agent-shared/scripts/codex-worktree-cleanup.sh >"$log")

  assert_contains "$log" "追跡中の静的サーバーはありません。"
}

test_invalid_and_stale_pid_files_are_removed() {
  local tmp_dir repo pid_file log
  tmp_dir="$(mktemp -d)"
  repo="$tmp_dir/repo"
  pid_file="$repo/.codex/.runtime/http-server.pid"
  log="$tmp_dir/cleanup.log"
  prepare_repo "$repo"

  printf 'invalid\n' > "$pid_file"
  (cd "$repo" && bash .agent-shared/scripts/codex-worktree-cleanup.sh >"$log")
  [ ! -e "$pid_file" ]
  assert_contains "$log" "PIDファイルが不正"

  printf '999999\n' > "$pid_file"
  (cd "$repo" && bash .agent-shared/scripts/codex-worktree-cleanup.sh >"$log")
  [ ! -e "$pid_file" ]
  assert_contains "$log" "既に終了しています"
}

test_does_not_stop_an_unrelated_command() {
  local tmp_dir repo pid_file unrelated_pid log
  tmp_dir="$(mktemp -d)"
  repo="$tmp_dir/repo"
  pid_file="$repo/.codex/.runtime/http-server.pid"
  log="$tmp_dir/cleanup.log"
  prepare_repo "$repo"

  (cd "$repo" && exec sleep 30) &
  unrelated_pid=$!
  printf '%s\n' "$unrelated_pid" > "$pid_file"

  (cd "$repo" && bash .agent-shared/scripts/codex-worktree-cleanup.sh >"$log")

  kill -0 "$unrelated_pid"
  kill "$unrelated_pid"
  wait "$unrelated_pid" 2>/dev/null || true
  assert_contains "$log" "対象プロセスは静的サーバーではありません"
}

test_does_not_stop_a_server_from_another_directory() {
  local tmp_dir repo other pid_file server_pid port log
  tmp_dir="$(mktemp -d)"
  repo="$tmp_dir/repo"
  other="$tmp_dir/other"
  pid_file="$repo/.codex/.runtime/http-server.pid"
  log="$tmp_dir/cleanup.log"
  mkdir -p "$other"
  prepare_repo "$repo"
  port="$(free_port)"

  (cd "$other" && exec python3 -m http.server "$port" --bind 127.0.0.1 >/dev/null 2>&1) &
  server_pid=$!
  printf '%s\n' "$server_pid" > "$pid_file"

  (cd "$repo" && bash .agent-shared/scripts/codex-worktree-cleanup.sh >"$log")

  kill -0 "$server_pid"
  kill "$server_pid"
  wait "$server_pid" 2>/dev/null || true
  assert_contains "$log" "別のディレクトリで起動されています"
}

test_stops_the_tracked_worktree_server() {
  local tmp_dir repo pid_file server_pid wrapper_pid port log
  tmp_dir="$(mktemp -d)"
  repo="$tmp_dir/repo"
  pid_file="$repo/.codex/.runtime/http-server.pid"
  log="$tmp_dir/up.log"
  prepare_repo "$repo"
  port="$(free_port)"

  (cd "$repo" && GENERATOR_PORT="$port" bash .agent-shared/scripts/codex-worktree-up.sh >"$log" 2>&1) &
  wrapper_pid=$!
  wait_for_file "$pid_file"
  server_pid="$(tr -d '[:space:]' < "$pid_file")"

  python3 - "$port" <<'PY'
import sys
import time
from urllib.request import urlopen
from urllib.error import URLError

url = f'http://127.0.0.1:{sys.argv[1]}/'
for _ in range(100):
    try:
        with urlopen(url, timeout=1) as response:
            assert response.status == 200
        break
    except URLError:
        time.sleep(0.05)
else:
    raise AssertionError(f'server did not become ready: {url}')
PY

  (cd "$repo" && bash .agent-shared/scripts/codex-worktree-cleanup.sh >/dev/null)
  wait "$wrapper_pid"

  if kill -0 "$server_pid" 2>/dev/null; then
    printf 'Expected server PID %s to be stopped\n' "$server_pid" >&2
    return 1
  fi
  [ ! -e "$pid_file" ]
}

test_no_running_server_is_a_noop
test_invalid_and_stale_pid_files_are_removed
test_does_not_stop_an_unrelated_command
test_does_not_stop_a_server_from_another_directory
test_stops_the_tracked_worktree_server

printf 'codex worktree lifecycle tests passed\n'
