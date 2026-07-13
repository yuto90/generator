import test from 'node:test';
import assert from 'node:assert/strict';

function createElement() {
  const attributes = new Map();
  const classes = new Set();
  return {
    inert: false,
    attributes,
    classList: {
      contains(name) { return classes.has(name); },
      toggle(name, active) {
        if (active) classes.add(name);
        else classes.delete(name);
      },
    },
    setAttribute(name, value) { attributes.set(name, value); },
  };
}

test('applyDrawerState synchronizes mobile drawer accessibility state', async () => {
  const drawerModule = await import('../drawer.js').catch(() => ({}));
  assert.equal(typeof drawerModule.applyDrawerState, 'function');

  const root = createElement();
  const toggle = createElement();
  const drawer = createElement();
  const backdrop = createElement();
  const elements = { root, toggle, drawer, backdrop };

  drawerModule.applyDrawerState(elements, true, true);
  assert.equal(root.classList.contains('drawer-open'), true);
  assert.equal(toggle.attributes.get('aria-expanded'), 'true');
  assert.equal(toggle.attributes.get('aria-label'), 'ジェネレーター一覧を閉じる');
  assert.equal(drawer.attributes.get('aria-hidden'), 'false');
  assert.equal(drawer.inert, false);
  assert.equal(backdrop.attributes.get('aria-hidden'), 'false');

  drawerModule.applyDrawerState(elements, false, true);
  assert.equal(root.classList.contains('drawer-open'), false);
  assert.equal(toggle.attributes.get('aria-expanded'), 'false');
  assert.equal(toggle.attributes.get('aria-label'), 'ジェネレーター一覧を開く');
  assert.equal(drawer.attributes.get('aria-hidden'), 'true');
  assert.equal(drawer.inert, true);
  assert.equal(backdrop.attributes.get('aria-hidden'), 'true');

  drawerModule.applyDrawerState(elements, false, false);
  assert.equal(drawer.attributes.get('aria-hidden'), 'false');
  assert.equal(drawer.inert, false);
});
