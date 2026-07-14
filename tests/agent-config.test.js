import test from 'node:test';
import assert from 'node:assert/strict';
import { lstat, readFile, readlink } from 'node:fs/promises';

const repoRoot = new URL('../', import.meta.url);

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8');
}

test('Codex and Claude Code load the same shared instructions', async () => {
  const agentsPath = new URL('AGENTS.md', repoRoot);
  const agentsStat = await lstat(agentsPath);
  const agentsTarget = await readlink(agentsPath);
  const claudeInstructions = await readRepoFile('CLAUDE.md');
  const commonInstructions = await readRepoFile('.agent-shared/instructions/common.md');

  assert.equal(agentsStat.isSymbolicLink(), true);
  assert.equal(agentsTarget, '.agent-shared/instructions/common.md');
  assert.match(claudeInstructions, /^@AGENTS\.md$/m);
  assert.match(commonInstructions, /generator-project-guide/);
  assert.match(commonInstructions, /node --test tests\/\*\.test\.js/);
});

test('Codex and Claude Code discover the same shared skill directory', async () => {
  const codexSkills = new URL('.agents/skills', repoRoot);
  const claudeSkills = new URL('.claude/skills', repoRoot);

  assert.equal((await lstat(codexSkills)).isSymbolicLink(), true);
  assert.equal((await lstat(claudeSkills)).isSymbolicLink(), true);
  assert.equal(await readlink(codexSkills), '../.agent-shared/skills');
  assert.equal(await readlink(claudeSkills), '../.agent-shared/skills');
});

test('shared generator project skill has provider-neutral metadata', async () => {
  const skill = await readRepoFile('.agent-shared/skills/generator-project-guide/SKILL.md');
  const openaiMetadata = await readRepoFile(
    '.agent-shared/skills/generator-project-guide/agents/openai.yaml',
  );

  assert.match(skill, /^name: generator-project-guide$/m);
  assert.match(skill, /^description: .+Generator.+$/m);
  assert.match(skill, /python3 -m http\.server 8000/);
  assert.match(skill, /node --test tests\/\*\.test\.js/);
  assert.match(openaiMetadata, /display_name: "Generator Project Guide"/);
  assert.match(openaiMetadata, /\$generator-project-guide/);
  assert.match(openaiMetadata, /allow_implicit_invocation: true/);
});

test('existing Claude launch configuration remains available', async () => {
  const launch = JSON.parse(await readRepoFile('.claude/launch.json'));

  assert.equal(launch.configurations[0].name, 'generator-portal');
  assert.equal(launch.configurations[0].runtimeExecutable, 'python3');
});
