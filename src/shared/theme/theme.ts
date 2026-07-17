export const THEME_STORAGE_KEY = 'generator-theme';

export type Theme = 'light' | 'dark';

export function normalizeTheme(value: unknown): Theme {
  return value === 'light' ? 'light' : 'dark';
}

export function readTheme(storage: Pick<Storage, 'getItem'> = window.localStorage): Theme {
  try {
    return normalizeTheme(storage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'dark';
  }
}

export function writeTheme(storage: Pick<Storage, 'setItem'> = window.localStorage, theme: Theme): void {
  try {
    storage.setItem(THEME_STORAGE_KEY, normalizeTheme(theme));
  } catch {
    // ストレージが使えなくても画面へのテーマ適用は継続できる
  }
}
