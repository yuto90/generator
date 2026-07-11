export const THEME_STORAGE_KEY = 'generator-theme';
export const THEME_MESSAGE_TYPE = 'generator-theme-change';

export function normalizeTheme(value) {
  return value === 'light' ? 'light' : 'dark';
}

export function readTheme(storage = window.localStorage) {
  try {
    return normalizeTheme(storage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'dark';
  }
}

export function writeTheme(storage = window.localStorage, theme) {
  try {
    storage.setItem(THEME_STORAGE_KEY, normalizeTheme(theme));
  } catch {
    // Storage may be unavailable; applying the theme to this page still works.
  }
}

export function applyTheme(root, toggle, theme) {
  const next = normalizeTheme(theme);
  root.dataset.theme = next;

  if (toggle) {
    const isLight = next === 'light';
    toggle.setAttribute('aria-pressed', String(isLight));
    toggle.setAttribute(
      'aria-label',
      isLight ? 'ダークモードに切り替える' : 'ライトモードに切り替える',
    );
    const label = toggle.querySelector('[data-theme-label]');
    if (label) label.textContent = isLight ? 'ライト' : 'ダーク';
  }

  return next;
}

export function isThemeMessage(event, origin) {
  return event.origin === origin
    && event.data?.type === THEME_MESSAGE_TYPE
    && ['light', 'dark'].includes(event.data.theme);
}

export function postTheme(targetWindow, origin, theme) {
  try {
    targetWindow.postMessage(
      { type: THEME_MESSAGE_TYPE, theme: normalizeTheme(theme) },
      origin,
    );
  } catch {
    // A disconnected peer must not prevent local theme changes.
  }
}
