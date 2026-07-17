import '@testing-library/jest-dom/vitest';

// jsdom は matchMedia を実装していないため、デスクトップ表示相当のスタブを与える
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
