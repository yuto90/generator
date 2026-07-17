export function parseTime(value: unknown): number | null {
  const match = String(value ?? '').trim().match(/^(\d+):([0-5]\d)$/);
  if (!match) return null;

  return (Number(match[1]) * 60) + Number(match[2]);
}

export function formatTime(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds)
    ? Math.max(0, Math.floor(seconds))
    : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function calculateProgress(current: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;

  const percentage = (Number(current) / duration) * 100;
  if (!Number.isFinite(percentage)) return 0;
  return Math.min(100, Math.max(0, percentage));
}
