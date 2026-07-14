import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(new URL('./sync-agent-mcp.mjs', import.meta.url));

async function createFixture(servers) {
  const root = await mkdtemp(path.join(tmpdir(), 'generator-agent-mcp-'));
  const source = path.join(root, 'servers.json');
  const claudeConfig = path.join(root, '.mcp.json');
  const codexConfig = path.join(root, '.codex', 'config.toml');

  await mkdir(path.dirname(codexConfig), { recursive: true });
  await writeFile(source, `${JSON.stringify({ version: 1, servers }, null, 2)}\n`);
  await writeFile(
    codexConfig,
    [
      'personality = "friendly"',
      '',
      '[mcp_servers.old]',
      'command = "stale"',
      '',
      '[profiles.local]',
      'approval_policy = "never"',
      '',
    ].join('\n'),
  );

  return { root, source, claudeConfig, codexConfig };
}

function syncArgs(fixture, ...extra) {
  return [
    scriptPath,
    '--source',
    fixture.source,
    '--claude-config',
    fixture.claudeConfig,
    '--codex-config',
    fixture.codexConfig,
    ...extra,
  ];
}

test('generates equivalent Claude and Codex MCP settings from one source', async () => {
  const fixture = await createFixture({
    tools: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@example/tools'],
      env: { MODE: 'safe' },
      env_vars: ['TOOLS_TOKEN'],
      startup_timeout_sec: 15,
      tool_timeout_sec: 30,
      enabled: true,
    },
    api: {
      type: 'http',
      url: 'https://example.com/mcp',
      bearer_token_env_var: 'API_TOKEN',
      http_headers: { 'X-Mode': 'safe' },
      env_http_headers: { 'X-API-Key': 'API_KEY' },
    },
  });

  await execFileAsync('node', syncArgs(fixture));

  const claude = JSON.parse(await readFile(fixture.claudeConfig, 'utf8'));
  const codex = await readFile(fixture.codexConfig, 'utf8');

  assert.deepEqual(claude.mcpServers.tools.env, {
    MODE: 'safe',
    TOOLS_TOKEN: '${TOOLS_TOKEN}',
  });
  assert.deepEqual(claude.mcpServers.api.headers, {
    Authorization: 'Bearer ${API_TOKEN}',
    'X-Mode': 'safe',
    'X-API-Key': '${API_KEY}',
  });
  assert.match(codex, /personality = "friendly"/);
  assert.match(codex, /\[profiles\.local\]/);
  assert.doesNotMatch(codex, /mcp_servers\.old|stale/);
  assert.match(codex, /\[mcp_servers\.tools\]/);
  assert.match(codex, /env_vars = \["TOOLS_TOKEN"\]/);
  assert.match(codex, /\[mcp_servers\.tools\.env\]/);
  assert.match(codex, /MODE = "safe"/);
  assert.match(codex, /\[mcp_servers\.api\]/);
  assert.match(codex, /bearer_token_env_var = "API_TOKEN"/);
  assert.match(codex, /env_http_headers = \{ "X-API-Key" = "API_KEY" \}/);
});

test('is idempotent and check mode detects generated config drift', async () => {
  const fixture = await createFixture({});

  await execFileAsync('node', syncArgs(fixture));
  const firstClaude = await readFile(fixture.claudeConfig, 'utf8');
  const firstCodex = await readFile(fixture.codexConfig, 'utf8');

  await execFileAsync('node', syncArgs(fixture));
  assert.equal(await readFile(fixture.claudeConfig, 'utf8'), firstClaude);
  assert.equal(await readFile(fixture.codexConfig, 'utf8'), firstCodex);
  await execFileAsync('node', syncArgs(fixture, '--check'));

  await writeFile(fixture.claudeConfig, '{"mcpServers":{"stale":{}}}\n');

  await assert.rejects(
    execFileAsync('node', syncArgs(fixture, '--check')),
    (error) => {
      assert.match(error.stderr, /out of date: .*\.mcp\.json/);
      return true;
    },
  );
});

test('rejects environment interpolation in MCP args', async () => {
  const fixture = await createFixture({
    unsafe: {
      type: 'stdio',
      command: 'example',
      args: ['--token', '${UNVERIFIED_TOKEN}'],
    },
  });

  await assert.rejects(
    execFileAsync('node', syncArgs(fixture)),
    (error) => {
      assert.match(error.stderr, /environment interpolation in args is not supported/);
      return true;
    },
  );
});

test('rejects literal secrets in shared MCP definitions', async () => {
  const fixture = await createFixture({
    unsafe: {
      type: 'stdio',
      command: 'example',
      env: { API_TOKEN: 'hardcoded-secret' },
    },
  });

  await assert.rejects(
    execFileAsync('node', syncArgs(fixture)),
    (error) => {
      assert.match(error.stderr, /sensitive value API_TOKEN must use env_vars/);
      return true;
    },
  );
});
