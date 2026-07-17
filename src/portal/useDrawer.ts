import { useCallback, useEffect, useRef, useState } from 'react';

const MOBILE_QUERY = '(max-width: 768px)';

interface FocusTargetContext {
  current: Element | null;
  menuToggle: HTMLElement | null;
  drawerItems: HTMLElement[];
}

/**
 * ドロワー内で Tab を押したときの移動先を返す(旧 drawer.js の移植)。
 * null はブラウザ標準のフォーカス移動に任せることを意味する。
 */
export function getDrawerFocusTarget(
  { current, menuToggle, drawerItems }: FocusTargetContext,
  shiftKey: boolean,
): HTMLElement | null {
  if (drawerItems.length === 0) return menuToggle;

  const first = drawerItems[0];
  const last = drawerItems[drawerItems.length - 1];
  const isInside = drawerItems.includes(current as HTMLElement);

  if (!isInside) return shiftKey ? last : first;
  if (shiftKey && current === first) return last;
  if (!shiftKey && current === last) return first;
  return null;
}

export interface DrawerState {
  /** ドロワーが開いているか(モバイル表示時のみ true になり得る) */
  isOpen: boolean;
  isMobile: boolean;
  openDrawer: () => void;
  closeDrawer: (returnFocus?: boolean) => void;
  toggleDrawer: () => void;
  menuToggleRef: React.RefObject<HTMLButtonElement | null>;
  drawerRef: React.RefObject<HTMLElement | null>;
}

export function useDrawer(): DrawerState {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  const menuToggleRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);

  const isOpen = open && isMobile;

  // :root.drawer-open で body スクロールを止める既存 CSS を活かす
  useEffect(() => {
    document.documentElement.classList.toggle('drawer-open', isOpen);
    return () => document.documentElement.classList.remove('drawer-open');
  }, [isOpen]);

  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const onChange = () => {
      setIsMobile(query.matches);
      setOpen(false);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const openDrawer = useCallback(() => {
    setOpen(true);
    requestAnimationFrame(() => {
      drawerRef.current
        ?.querySelector<HTMLElement>('.gen-item.active, .gen-item')
        ?.focus();
    });
  }, []);

  const closeDrawer = useCallback((returnFocus = true) => {
    setOpen(wasOpen => {
      if (returnFocus && wasOpen && window.matchMedia(MOBILE_QUERY).matches) {
        menuToggleRef.current?.focus();
      }
      return false;
    });
  }, []);

  const toggleDrawer = useCallback(() => {
    if (isOpen) closeDrawer();
    else openDrawer();
  }, [isOpen, closeDrawer, openDrawer]);

  // Tab のフォーカストラップと Escape での閉鎖
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDrawer();
        return;
      }
      if (event.key !== 'Tab') return;

      const drawerItems = [
        ...(drawerRef.current?.querySelectorAll<HTMLElement>('.gen-item') ?? []),
      ];
      const target = getDrawerFocusTarget(
        { current: document.activeElement, menuToggle: menuToggleRef.current, drawerItems },
        event.shiftKey,
      );
      if (target) {
        event.preventDefault();
        target.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, closeDrawer]);

  return { isOpen, isMobile, openDrawer, closeDrawer, toggleDrawer, menuToggleRef, drawerRef };
}
