import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { lstat, readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repoRoot = new URL('../', import.meta.url);

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8');
}

test('Codex local environment exposes setup, cleanup, and common actions', async () => {
  const config = await readRepoFile('.codex/environments/default.toml');

  assert.match(config, /^version = 1$/m);
  assert.match(config, /^name = "Generator"$/m);
  assert.match(config, /script = "bash \.codex\/scripts\/codex-worktree-setup\.sh"/);
  assert.match(config, /script = "bash \.codex\/scripts\/codex-worktree-cleanup\.sh"/);
  assert.match(config, /name = "up"[\s\S]*codex-worktree-up\.sh/);
  assert.match(config, /name = "down"[\s\S]*codex-worktree-cleanup\.sh/);
  assert.match(config, /name = "test"[\s\S]*node --test/);
});

test('runtime state is ignored and environment scripts are executable', async () => {
  assert.equal((await readRepoFile('.codex/.gitignore')).trim(), '.runtime/');

  for (const script of [
    '.codex/scripts/codex-worktree-setup.sh',
    '.codex/scripts/codex-worktree-up.sh',
    '.codex/scripts/codex-worktree-cleanup.sh',
  ]) {
    const stat = await lstat(new URL(script, repoRoot));
    assert.notEqual(stat.mode & 0o111, 0, `${script} must be executable`);
  }
});

test('セットアップで必要なツールを確認する', async () => {
  const { stdout } = await execFileAsync(
    'bash',
    ['.codex/scripts/codex-worktree-setup.sh'],
    { cwd: repoRoot },
  );

  assert.match(stdout, /Python:/);
  assert.match(stdout, /Node:/);

});
