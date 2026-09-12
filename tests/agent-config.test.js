import test from 'node:test';
import assert from 'node:assert/strict';
import { lstat, readFile } from 'node:fs/promises';

const repoRoot = new URL('../', import.meta.url);

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8');
}

test('Codex の指示と skill を通常ファイルから読み込める', async () => {
  assert.equal((await lstat(new URL('AGENTS.md', repoRoot))).isFile(), true);
  assert.equal((await lstat(new URL('.agents/skills', repoRoot))).isDirectory(), true);
  const instructions = await readRepoFile('AGENTS.md');
  assert.match(instructions, /generator-project-guide/);
  assert.match(instructions, /npm test/);
  for (const path of ['.agent-shared', '.claude', 'CLAUDE.md', '.mcp.json']) {
    await assert.rejects(lstat(new URL(path, repoRoot)), { code: 'ENOENT' });
  }
});

test('プロジェクト skill に Codex 用メタデータがある', async () => {
  const skill = await readRepoFile('.agents/skills/generator-project-guide/SKILL.md');
  const openaiMetadata = await readRepoFile(
    '.agents/skills/generator-project-guide/agents/openai.yaml',
  );

  assert.match(skill, /^name: generator-project-guide$/m);
  assert.match(skill, /^description: .+Generator.+$/m);
  assert.match(skill, /npm run dev/);
  assert.match(skill, /npm test/);
  assert.match(openaiMetadata, /display_name: "Generator Project Guide"/);
  assert.match(openaiMetadata, /\$generator-project-guide/);
  assert.match(openaiMetadata, /allow_implicit_invocation: true/);
});
