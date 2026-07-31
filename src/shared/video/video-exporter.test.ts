import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VideoClipRange } from './video-types';

const mediabunny = vi.hoisted(() => ({
  canEncodeVideo: vi.fn(),
  canEncodeAudio: vi.fn(),
  BufferTarget: vi.fn(),
  Mp4OutputFormat: vi.fn(),
  Output: vi.fn(),
  CanvasSource: vi.fn(),
  AudioBufferSource: vi.fn(),
}));
const capture = vi.hoisted(() => ({ toCanvas: vi.fn() }));

vi.mock('mediabunny', () => mediabunny);
vi.mock('html-to-image', () => capture);

import { detectVideoCapabilities } from './video-capabilities';
import { exportPlayerVideo, trimAndNormalizeAudio } from './video-exporter';

const range: VideoClipRange = { start: 1, end: 2, duration: 1 };

function createAudioBuffer(channels = 2): AudioBuffer {
  const data = Array.from({ length: channels }, (_, channel) => new Float32Array([channel + 1, channel + 2, channel + 3, channel + 4]));
  return {
    numberOfChannels: channels,
    length: 4,
    sampleRate: 48_000,
    duration: 4 / 48_000,
    getChannelData: (channel: number) => data[channel],
  } as AudioBuffer;
}

describe('detectVideoCapabilities', () => {
  beforeEach(() => {
    mediabunny.canEncodeVideo.mockResolvedValue(true);
    mediabunny.canEncodeAudio.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('AAC エンコーダーがないことを返す', async () => {
    mediabunny.canEncodeAudio.mockResolvedValue(false);

    await expect(detectVideoCapabilities(1080, 1920)).resolves.toEqual({
      supported: false,
      video: true,
      audio: false,
      message: 'AAC 音声エンコーダーに対応していないブラウザです。',
    });
  });

  it('H.264 エンコーダーがないことを返す', async () => {
    mediabunny.canEncodeVideo.mockResolvedValue(false);

    await expect(detectVideoCapabilities(1080, 1920)).resolves.toEqual({
      supported: false,
      video: false,
      audio: true,
      message: 'H.264 映像エンコーダーに対応していないブラウザです。',
    });
  });
});

describe('trimAndNormalizeAudio', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('48kHz・最大2チャンネルへ切り出し、音量を適用する', () => {
    const output = createAudioBuffer(2);
    const createBuffer = vi.fn(() => output);
    const OfflineAudioContext = vi.fn(() => ({ createBuffer }));
    vi.stubGlobal('OfflineAudioContext', OfflineAudioContext);

    const result = trimAndNormalizeAudio(createAudioBuffer(3), { start: 0, end: 4 / 48_000, duration: 4 / 48_000 }, 0.5);

    expect(result).toBe(output);
    expect(OfflineAudioContext).toHaveBeenCalledWith(2, 4, 48_000);
    expect(createBuffer).toHaveBeenCalledWith(2, 4, 48_000);
    expect(Array.from(result.getChannelData(0))).toEqual([0.5, 1, 1.5, 2]);
  });
});

describe('exportPlayerVideo', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('開始前に中断されていれば MP4 出力を作成せずに拒否する', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(exportPlayerVideo({
      card: document.createElement('div'),
      range,
      audio: createAudioBuffer(),
      volume: 1,
      onFrame: vi.fn(),
      signal: controller.signal,
    })).rejects.toThrow('動画の生成をキャンセルしました。');

    expect(mediabunny.Output).not.toHaveBeenCalled();
    expect(capture.toCanvas).not.toHaveBeenCalled();
  });
});
