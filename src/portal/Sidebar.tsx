import { NavLink } from 'react-router';
import { GENERATORS } from '../generators';
import { ThemeToggle } from '../shared/theme/ThemeToggle';

interface SidebarProps {
  isMobile: boolean;
  isOpen: boolean;
  drawerRef: React.RefObject<HTMLElement | null>;
  onSelect: () => void;
}

export function Sidebar({ isMobile, isOpen, drawerRef, onSelect }: SidebarProps) {
  const hidden = isMobile && !isOpen;

  return (
    <aside
      id="generator-drawer"
      className="sidebar"
      aria-label="ジェネレーター一覧"
      aria-hidden={hidden}
      inert={hidden}
      ref={drawerRef as React.RefObject<HTMLElement>}
    >
      <div className="sidebar-header">
        <div className="dot" />
        <h1>Generators</h1>
      </div>
      <p className="sidebar-sub">作りたいプレーヤーを選択</p>
      <nav id="gen-list" aria-label="ジェネレーターを選択">
        {GENERATORS.map(gen => (
          <NavLink
            key={gen.id}
            to={`/${gen.id}`}
            className={({ isActive }) => (isActive ? 'gen-item active' : 'gen-item')}
            onClick={onSelect}
          >
            <div className="gen-icon" style={{ background: gen.color }}>{gen.icon}</div>
            <div className="gen-info">
              <div className="gen-name">{gen.name}</div>
              <div className="gen-desc">{gen.desc}</div>
            </div>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className="sidebar-footer-label">music player generators</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
