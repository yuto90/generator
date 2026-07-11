import test from 'node:test';
import assert from 'node:assert/strict';

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
