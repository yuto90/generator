import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('LINEトークの1024px境界は編集パネルを縦積みにして横切れを防ぐ', async () => {
  const css = await readFile('src/apps/line_talk/line-talk.css', 'utf8');
  assert.match(css, /@media \(max-width: 1024px\)[\s\S]*?\.line-talk-layout\s*\{[\s\S]*?display:\s*flex/);
});
