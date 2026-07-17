import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { GENERATORS } from '../generators';
import { MobileHeader } from './MobileHeader';
import { Sidebar } from './Sidebar';
import { useDrawer } from './useDrawer';
import './portal.css';

export function PortalLayout() {
  const drawer = useDrawer();
  const location = useLocation();
  const active = GENERATORS.find(gen => `/${gen.id}` === location.pathname) ?? GENERATORS[0];

  useEffect(() => {
    document.title = active.title;
  }, [active]);

  // ルート遷移時は必ずドロワーを閉じる(サイドバー以外からの遷移への保険)
  const { closeDrawer } = drawer;
  useEffect(() => {
    closeDrawer(false);
  }, [location.pathname, closeDrawer]);

  return (
    <>
      <MobileHeader
        generatorName={active.name}
        isOpen={drawer.isOpen}
        menuToggleRef={drawer.menuToggleRef}
        onMenuClick={drawer.toggleDrawer}
      />
      <Sidebar
        isMobile={drawer.isMobile}
        isOpen={drawer.isOpen}
        drawerRef={drawer.drawerRef}
        onSelect={() => drawer.closeDrawer()}
      />
      <div
        className="drawer-backdrop"
        aria-hidden={!drawer.isOpen}
        onClick={() => drawer.closeDrawer()}
      />
      <main className="main" inert={drawer.isOpen}>
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>
    </>
  );
}
