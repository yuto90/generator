import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const repoRoot = new URL('../', import.meta.url);

test('Vercel は Vite の出力先を配信する', async () => {
  const config = JSON.parse(await readFile(new URL('vercel.json', repoRoot), 'utf8'));

  assert.equal(config.outputDirectory, 'dist');
});
