#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');

function parseArgs(argv) {
  const parsed = new Map();

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) {
      continue;
    }

    const key = item.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      parsed.set(key, next);
      index += 1;
    } else {
      parsed.set(key, true);
    }
  }

  return parsed;
}

function cleanObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );
}

function assertRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function validateServer(name, server) {
  assertRecord(server, `server ${name}`);

  if (!['stdio', 'http'].includes(server.type)) {
    throw new Error(`server ${name} has unsupported type: ${server.type}`);
  }

  if (server.type === 'stdio' && typeof server.command !== 'string') {
    throw new Error(`stdio server ${name} requires command`);
  }

  if (server.type === 'http' && typeof server.url !== 'string') {
    throw new Error(`http server ${name} requires url`);
  }

  for (const arg of server.args || []) {
    if (typeof arg !== 'string') {
      throw new Error(`server ${name} args must contain only strings`);
    }
    if (arg.includes('${')) {
      throw new Error(
        `server ${name}: environment interpolation in args is not supported; use env_vars or env_http_headers`,
      );
    }
  }

  for (const envName of server.env_vars || []) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(envName)) {
      throw new Error(`server ${name} has invalid env var name: ${envName}`);
    }
  }

  for (const envName of Object.keys(server.env || {})) {
    if (/(?:TOKEN|SECRET|PASSWORD|API_KEY|ACCESS_KEY|PRIVATE_KEY)/i.test(envName)) {
      throw new Error(
        `server ${name}: sensitive value ${envName} must use env_vars instead of env`,
      );
    }
  }
}

function inheritedEnv(envNames = []) {
  return Object.fromEntries(envNames.map((name) => [name, `\${${name}}`]));
}

function toClaudeServer(server) {
  if (server.type === 'stdio') {
    const env = { ...(server.env || {}), ...inheritedEnv(server.env_vars) };

    return cleanObject({
      type: 'stdio',
      command: server.command,
      args: server.args || [],
      env: Object.keys(env).length > 0 ? env : undefined,
    });
  }

  const headers = {
    ...(server.bearer_token_env_var
      ? { Authorization: `Bearer \${${server.bearer_token_env_var}}` }
      : {}),
    ...(server.http_headers || {}),
    ...Object.fromEntries(
      Object.entries(server.env_http_headers || {}).map(([header, envName]) => [
        header,
        `\${${envName}}`,
      ]),
    ),
  };

  return cleanObject({
    type: 'http',
    url: server.url,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });
}

function toClaudeJson(servers) {
  return `${JSON.stringify(
    {
      mcpServers: Object.fromEntries(
        Object.entries(servers).map(([name, server]) => [name, toClaudeServer(server)]),
      ),
    },
    null,
    2,
  )}\n`;
}

function tomlValue(value) {
  if (Array.isArray(value)) {
    return `[${value.map(tomlValue).join(', ')}]`;
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  throw new Error(`unsupported TOML value: ${JSON.stringify(value)}`);
}

function tableKey(value) {
  return /^[A-Za-z0-9_-]+$/.test(value) ? value : JSON.stringify(value);
}

function pushScalar(lines, key, value) {
  if (value !== undefined && value !== null) {
    lines.push(`${key} = ${tomlValue(value)}`);
  }
}

function pushInlineObject(lines, key, value) {
  if (!value || Object.keys(value).length === 0) {
    return;
  }

  const body = Object.entries(value)
    .map(([objectKey, objectValue]) => `${JSON.stringify(objectKey)} = ${tomlValue(objectValue)}`)
    .join(', ');
  lines.push(`${key} = { ${body} }`);
}

function toCodexMcpToml(servers) {
  const lines = [
    '# MCP server sections generated from .agent-shared/mcp/servers.json.',
    '# Edit the shared source, then run:',
    '# node .agent-shared/scripts/sync-agent-mcp.mjs',
  ];

  for (const [name, server] of Object.entries(servers)) {
    const nameKey = tableKey(name);
    lines.push('', `[mcp_servers.${nameKey}]`);

    if (server.type === 'stdio') {
      pushScalar(lines, 'command', server.command);
      pushScalar(lines, 'args', server.args || []);
      pushScalar(lines, 'cwd', server.cwd);
      pushScalar(lines, 'env_vars', server.env_vars);
    } else {
      pushScalar(lines, 'url', server.url);
      pushScalar(lines, 'bearer_token_env_var', server.bearer_token_env_var);
      pushInlineObject(lines, 'http_headers', server.http_headers);
      pushInlineObject(lines, 'env_http_headers', server.env_http_headers);
    }

    pushScalar(lines, 'startup_timeout_sec', server.startup_timeout_sec);
    pushScalar(lines, 'tool_timeout_sec', server.tool_timeout_sec);
    pushScalar(lines, 'enabled', server.enabled);

    if (server.env && Object.keys(server.env).length > 0) {
      lines.push('', `[mcp_servers.${nameKey}.env]`);
      for (const [envKey, envValue] of Object.entries(server.env)) {
        pushScalar(lines, envKey, envValue);
      }
    }
  }

  return `${lines.join('\n')}\n`;
}

function isTomlTableHeader(line) {
  return /^\s*\[[^\]]+\]\s*(?:#.*)?$/.test(line);
}

function isMcpTableHeader(line) {
  return /^\s*\[mcp_servers(?:\]|\.)/.test(line);
}

function isGeneratedMcpComment(line) {
  return [
    '# MCP server sections generated from .agent-shared/mcp/servers.json.',
    '# Edit the shared source, then run:',
    '# node .agent-shared/scripts/sync-agent-mcp.mjs',
  ].includes(line);
}

function stripCodexMcpSections(toml) {
  const kept = [];
  let skippingMcp = false;

  for (const line of toml.replace(/\r\n/g, '\n').split('\n')) {
    if (isGeneratedMcpComment(line)) {
      continue;
    }
    if (isMcpTableHeader(line)) {
      skippingMcp = true;
      continue;
    }
    if (skippingMcp) {
      if (isTomlTableHeader(line)) {
        skippingMcp = false;
        kept.push(line);
      }
      continue;
    }
    kept.push(line);
  }

  while (kept.at(-1)?.trim() === '') {
    kept.pop();
  }
  return kept.join('\n').trimEnd();
}

function mergeCodexConfig(existing, generatedMcp) {
  const base = stripCodexMcpSections(existing);
  return base ? `${base}\n\n${generatedMcp}` : generatedMcp;
}

async function readOptional(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

const args = parseArgs(process.argv.slice(2));
const sourcePath = path.resolve(String(args.get('source') || path.join(repoRoot, '.agent-shared/mcp/servers.json')));
const claudeConfigPath = path.resolve(String(args.get('claude-config') || path.join(repoRoot, '.mcp.json')));
const codexConfigPath = path.resolve(String(args.get('codex-config') || path.join(repoRoot, '.codex/config.toml')));
const checkOnly = args.has('check');

const source = JSON.parse(await readFile(sourcePath, 'utf8'));
assertRecord(source, 'MCP source');
const servers = source.servers || {};
assertRecord(servers, 'MCP servers');

for (const [name, server] of Object.entries(servers)) {
  validateServer(name, server);
}

const expectedClaude = toClaudeJson(servers);
const existingCodex = await readOptional(codexConfigPath);
const expectedCodex = mergeCodexConfig(existingCodex, toCodexMcpToml(servers));

if (checkOnly) {
  const stalePaths = [];
  if ((await readOptional(claudeConfigPath)) !== expectedClaude) {
    stalePaths.push(claudeConfigPath);
  }
  if ((await readOptional(codexConfigPath)) !== expectedCodex) {
    stalePaths.push(codexConfigPath);
  }

  for (const stalePath of stalePaths) {
    console.error(`out of date: ${stalePath}`);
  }
  if (stalePaths.length > 0) {
    process.exitCode = 1;
  }
} else {
  await mkdir(path.dirname(claudeConfigPath), { recursive: true });
  await mkdir(path.dirname(codexConfigPath), { recursive: true });
  await writeFile(claudeConfigPath, expectedClaude);
  await writeFile(codexConfigPath, expectedCodex);
  console.log(`Updated ${claudeConfigPath}`);
  console.log(`Updated ${codexConfigPath}`);
}
