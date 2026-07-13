import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  normalizeTheme,
  readTheme,
  writeTheme,
  applyTheme,
  isThemeMessage,
  postTheme,
} from '../theme.js';

test('normalizeTheme accepts only light and dark', () => {
  assert.equal(normalizeTheme('light'), 'light');
  assert.equal(normalizeTheme('dark'), 'dark');
  assert.equal(normalizeTheme('system'), 'dark');
  assert.equal(normalizeTheme(null), 'dark');
});

test('storage errors fall back without throwing', () => {
  const broken = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };

  assert.equal(readTheme(broken), 'dark');
  assert.doesNotThrow(() => writeTheme(broken, 'light'));
});

test('applyTheme updates root and accessible toggle state', () => {
  const label = { textContent: '' };
  const root = { dataset: {} };
  const toggle = {
    setAttribute(name, value) { this[name] = value; },
    querySelector() { return label; },
  };

  assert.equal(applyTheme(root, toggle, 'light'), 'light');
  assert.equal(root.dataset.theme, 'light');
  assert.equal(toggle['aria-pressed'], 'true');
  assert.equal(toggle['aria-label'], 'ダークモードに切り替える');
  assert.equal(label.textContent, 'ライト');
});

test('messages require the expected origin, type, and theme', () => {
  const origin = 'http://127.0.0.1:8000';
  const valid = {
    origin,
    data: { type: 'generator-theme-change', theme: 'light' },
  };

  assert.equal(isThemeMessage(valid, origin), true);
  assert.equal(isThemeMessage({ ...valid, origin: 'https://example.com' }, origin), false);
  assert.equal(isThemeMessage({ ...valid, data: { type: 'other', theme: 'light' } }, origin), false);
  assert.equal(isThemeMessage({ ...valid, data: { type: 'generator-theme-change', theme: 'system' } }, origin), false);
});

test('postTheme sends a normalized message', () => {
  const calls = [];
  const target = { postMessage: (...args) => calls.push(args) };

  postTheme(target, 'http://127.0.0.1:8000', 'light');

  assert.deepEqual(calls, [[
    { type: 'generator-theme-change', theme: 'light' },
    'http://127.0.0.1:8000',
  ]]);
});

test('portal exposes an accessible toggle and imports shared theme logic', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /data-theme-toggle/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /from '\.\/theme\.js'/);
  assert.match(html, /isThemeMessage/);
  assert.match(html, /postTheme/);
});

test('portal exposes accessible mobile drawer controls', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /class="mobile-header"/);
  assert.match(html, /class="menu-toggle"[^>]*aria-controls="generator-drawer"[^>]*aria-expanded="false"/);
  assert.match(html, /id="mobile-generator-name"/);
  assert.match(html, /id="generator-drawer"[^>]*aria-label="ジェネレーター一覧"/);
  assert.match(html, /id="gen-list"[^>]*aria-label="ジェネレーターを選択"/);
  assert.match(html, /class="drawer-backdrop"[^>]*aria-hidden="true"/);
});

test('portal wires the mobile drawer open and dismissal paths', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /from '\.\/drawer\.js'/);
  assert.match(html, /menuToggle\.addEventListener\('click'/);
  assert.match(html, /backdrop\.addEventListener\('click'/);
  assert.match(html, /event\.key === 'Escape'/);
  assert.match(html, /closeDrawer\(false\)/);
  assert.match(html, /syncDrawerForViewport/);
});

test('music player wires theme UI and both card palettes', async () => {
  const [html, js] = await Promise.all([
    readFile(new URL('../music_player/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../music_player/app.js', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /data-theme-toggle/);
  assert.match(html, /:root\[data-theme="light"\]/);
  assert.match(js, /\.\.\/theme\.js/);
  assert.match(js, /dark:\s*\{\s*bgColor:\s*'#1a1825'/);
  assert.match(js, /light:\s*\{\s*bgColor:\s*'#f1efff'/);
  assert.doesNotMatch(html, /via\.placeholder\.com|icon="volume-low"/);
  assert.doesNotMatch(js, /via\.placeholder\.com/);
});

test('apple music wires theme UI and both card palettes', async () => {
  const [html, js] = await Promise.all([
    readFile(new URL('../apple_music_player/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../apple_music_player/app.js', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /data-theme-toggle/);
  assert.match(html, /:root\[data-theme="light"\]/);
  assert.match(js, /\.\.\/theme\.js/);
  assert.match(js, /dark:\s*\{\s*bgColor:\s*'#8e3b52'/);
  assert.match(js, /light:\s*\{\s*bgColor:\s*'#f2b6c4'/);
});

test('youtube music wires theme UI and both card palettes', async () => {
  const [html, js] = await Promise.all([
    readFile(new URL('../youtube_music_player/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../youtube_music_player/app.js', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /data-theme-toggle/);
  assert.match(html, /:root\[data-theme="light"\]/);
  assert.match(js, /\.\.\/theme\.js/);
  assert.match(js, /dark:\s*\{\s*bgColor:\s*'#030303'/);
  assert.match(js, /light:\s*\{\s*bgColor:\s*'#f4f4f4'/);
});
