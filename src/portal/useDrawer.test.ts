import { describe, expect, test } from 'vitest';
import { getDrawerFocusTarget } from './useDrawer';

function el(name: string): HTMLElement {
  const element = document.createElement('button');
  element.dataset.name = name;
  return element;
}

describe('getDrawerFocusTarget', () => {
  const menuToggle = el('menu');
  const first = el('first');
  const middle = el('middle');
  const last = el('last');
  const drawerItems = [first, middle, last];

  test('ドロワーに項目がなければメニューボタンへ戻す', () => {
    expect(getDrawerFocusTarget({ current: null, menuToggle, drawerItems: [] }, false)).toBe(menuToggle);
  });

  test('ドロワー外からの Tab は先頭(Shift+Tab は末尾)へ移す', () => {
    expect(getDrawerFocusTarget({ current: menuToggle, menuToggle, drawerItems }, false)).toBe(first);
    expect(getDrawerFocusTarget({ current: menuToggle, menuToggle, drawerItems }, true)).toBe(last);
  });

  test('端に達したら反対側へ循環する', () => {
    expect(getDrawerFocusTarget({ current: last, menuToggle, drawerItems }, false)).toBe(first);
    expect(getDrawerFocusTarget({ current: first, menuToggle, drawerItems }, true)).toBe(last);
  });

  test('中間の項目ではブラウザ標準のフォーカス移動に任せる', () => {
    expect(getDrawerFocusTarget({ current: middle, menuToggle, drawerItems }, false)).toBeNull();
    expect(getDrawerFocusTarget({ current: middle, menuToggle, drawerItems }, true)).toBeNull();
  });
});
