export function parseTime(value) {
  const match = String(value ?? '').trim().match(/^(\d+):([0-5]\d)$/);
  if (!match) return null;

  return (Number(match[1]) * 60) + Number(match[2]);
}

export function formatTime(seconds) {
  const safeSeconds = Number.isFinite(seconds)
    ? Math.max(0, Math.floor(seconds))
    : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function calculateProgress(current, duration) {
  if (!Number.isFinite(duration) || duration <= 0) return 0;

  const percentage = (Number(current) / duration) * 100;
  if (!Number.isFinite(percentage)) return 0;
  return Math.min(100, Math.max(0, percentage));
}

export function extractYouTubeId(input) {
  const value = String(input ?? '').trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    let candidate = '';

    if (hostname === 'youtu.be' || hostname.endsWith('.youtu.be')) {
      candidate = url.pathname.split('/').filter(Boolean)[0] || '';
    } else if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'live'].includes(parts[0])) {
        candidate = parts[1] || '';
      } else {
        candidate = url.searchParams.get('v') || '';
      }
    }

    return /^[a-zA-Z0-9_-]{11}$/.test(candidate) ? candidate : '';
  } catch {
    return '';
  }
}
