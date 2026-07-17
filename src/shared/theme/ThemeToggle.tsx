import type { ButtonHTMLAttributes } from 'react';
import { useTheme } from './ThemeContext';

interface ThemeToggleProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  /** ラベル(ダーク/ライト)の span に付けるクラス。モバイルでは visually-hidden を渡す */
  labelClassName?: string;
}

/**
 * 旧構成で全ページに複製されていたテーマ切替ボタン。
 * aria-pressed / aria-label / ラベル文言は theme.js 時代の値を維持している。
 */
export function ThemeToggle({ className = 'theme-toggle', labelClassName, ...rest }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <button
      {...rest}
      type="button"
      className={className}
      data-theme-toggle
      aria-pressed={isLight}
      aria-label={isLight ? 'ダークモードに切り替える' : 'ライトモードに切り替える'}
      onClick={toggleTheme}
    >
      <span className="theme-icon" aria-hidden="true">☀︎ / ☾</span>
      <span className={labelClassName} data-theme-label>{isLight ? 'ライト' : 'ダーク'}</span>
    </button>
  );
}
