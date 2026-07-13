export function applyDrawerState({ root, toggle, drawer, backdrop }, open, isMobile) {
  const isOpen = Boolean(open && isMobile);

  root.classList.toggle('drawer-open', isOpen);
  toggle.setAttribute('aria-expanded', String(isOpen));
  toggle.setAttribute(
    'aria-label',
    isOpen ? 'ジェネレーター一覧を閉じる' : 'ジェネレーター一覧を開く',
  );
  drawer.setAttribute('aria-hidden', String(isMobile && !isOpen));
  drawer.inert = Boolean(isMobile && !isOpen);
  backdrop.setAttribute('aria-hidden', String(!isOpen));

  return isOpen;
}
