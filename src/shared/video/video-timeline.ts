import type { VideoClipRange } from './video-types';

const MAX_CLIP_DURATION = 30;

export function parseVideoStartTime(value: string): number | null {
  const match = /^(\d+):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds >= 60) return null;

  return minutes * 60 + seconds;
}

export function calculateVideoClipRange(audioDuration: number, start: number): VideoClipRange | null {
  if (!Number.isFinite(audioDuration) || !Number.isFinite(start) || audioDuration < 1 || start < 0 || start >= audioDuration) {
    return null;
  }

  const end = Math.min(start + MAX_CLIP_DURATION, audioDuration);
  if (end - start < 1) return null;

  return { start, end, duration: end - start };
}

export function getVideoFrameTime(range: VideoClipRange, frameIndex: number, fps = 30): number {
  if (!Number.isFinite(frameIndex) || !Number.isFinite(fps) || fps <= 0) return range.start;

  return Math.min(range.start + Math.max(0, frameIndex) / fps, range.end);
}

export function calculateVideoOutputHeight(cssWidth: number, cssHeight: number, outputWidth = 1080): number {
  if (!Number.isFinite(cssWidth) || !Number.isFinite(cssHeight) || !Number.isFinite(outputWidth) || cssWidth <= 0 || cssHeight <= 0 || outputWidth <= 0) {
    return 0;
  }

  return Math.round((cssHeight / cssWidth) * outputWidth);
}
