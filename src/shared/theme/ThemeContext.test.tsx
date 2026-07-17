import { beforeEach, describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from './ThemeContext';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeProvider + ThemeToggle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  test('初期状態はダークで、ルート要素とトグルの aria 状態を設定する', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(document.documentElement.dataset.theme).toBe('dark');
    const toggle = screen.getByRole('button', { name: 'ライトモードに切り替える' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveTextContent('ダーク');
  });

  test('クリックでライトへ切り替わり localStorage に永続化される', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'ライトモードに切り替える' }));

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem('generator-theme')).toBe('light');
    const toggle = screen.getByRole('button', { name: 'ダークモードに切り替える' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveTextContent('ライト');
  });

  test('保存済みの generator-theme キーを初期値として引き継ぐ', () => {
    window.localStorage.setItem('generator-theme', 'light');

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
