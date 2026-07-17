import { describe, expect, test } from 'vitest';
import { normalizeTheme, readTheme, writeTheme } from './theme';

describe('normalizeTheme', () => {
  test('light と dark のみ受け付ける', () => {
    expect(normalizeTheme('light')).toBe('light');
    expect(normalizeTheme('dark')).toBe('dark');
    expect(normalizeTheme('system')).toBe('dark');
    expect(normalizeTheme(null)).toBe('dark');
  });
});

describe('readTheme / writeTheme', () => {
  test('ストレージ例外時は投げずにダークへフォールバックする', () => {
    const broken = {
      getItem(): string | null { throw new Error('blocked'); },
      setItem(): void { throw new Error('blocked'); },
    };

    expect(readTheme(broken)).toBe('dark');
    expect(() => writeTheme(broken, 'light')).not.toThrow();
  });

  test('localStorage の generator-theme キーで読み書きする', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
    };

    writeTheme(storage, 'light');
    expect(store.get('generator-theme')).toBe('light');
    expect(readTheme(storage)).toBe('light');
  });
});
