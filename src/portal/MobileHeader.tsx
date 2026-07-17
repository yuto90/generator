import { ThemeToggle } from '../shared/theme/ThemeToggle';

interface MobileHeaderProps {
  generatorName: string;
  isOpen: boolean;
  menuToggleRef: React.RefObject<HTMLButtonElement | null>;
  onMenuClick: () => void;
}

export function MobileHeader({ generatorName, isOpen, menuToggleRef, onMenuClick }: MobileHeaderProps) {
  return (
    <header className="mobile-header">
      <button
        type="button"
        className="menu-toggle"
        aria-controls="generator-drawer"
        aria-expanded={isOpen}
        aria-label={isOpen ? 'ジェネレーター一覧を閉じる' : 'ジェネレーター一覧を開く'}
        ref={menuToggleRef}
        onClick={onMenuClick}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>
      <div id="mobile-generator-name" aria-live="polite">{generatorName}</div>
      <ThemeToggle
        className="theme-toggle mobile-theme-toggle"
        labelClassName="visually-hidden"
        inert={isOpen}
      />
    </header>
  );
}
