const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

/**
 * YouTube の各種 URL 形式(watch/youtu.be/embed/shorts/live)や ID 直接入力から動画 ID を取り出す。
 * youtube.com / youtu.be 以外のドメインは拒否する(spotify_player/player-utils.js 由来の挙動)。
 * URL として解析できない `watch?v=…` のような入力だけ `?v=` フォールバックを許す(music_player 由来)。
 */
export function extractYouTubeId(input: unknown): string {
  const value = String(input ?? '').trim();
  if (VIDEO_ID_PATTERN.test(value)) return value;

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

    return VIDEO_ID_PATTERN.test(candidate) ? candidate : '';
  } catch {
    const match = value.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : '';
  }
}
