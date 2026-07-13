export function applyDrawerState(
  { root, toggle, drawer, backdrop, main, mobileThemeToggle },
  open,
  isMobile,
) {
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
  main.inert = isOpen;
  mobileThemeToggle.inert = isOpen;

  return isOpen;
}

export function getDrawerFocusTarget({ current, menuToggle, drawerItems }, shiftKey) {
  if (drawerItems.length === 0) return menuToggle;

  const first = drawerItems[0];
  const last = drawerItems[drawerItems.length - 1];
  const isInside = drawerItems.includes(current);

  if (!isInside) return shiftKey ? last : first;
  if (shiftKey && current === first) return last;
  if (!shiftKey && current === last) return first;
  return null;
}
