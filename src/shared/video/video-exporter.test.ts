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
  const output = {
    addVideoTrack: vi.fn(),
    addAudioTrack: vi.fn(),
    start: vi.fn(() => Promise.resolve()),
    finalize: vi.fn(() => Promise.resolve()),
    cancel: vi.fn(() => Promise.resolve()),
  };
  const videoSource = { add: vi.fn<(timestamp: number, duration?: number) => Promise<void>>(() => Promise.resolve()) };
  const audioSource = { add: vi.fn<(audio: AudioBuffer) => Promise<void>>(() => Promise.resolve()) };
  const target = { buffer: new Uint8Array([1, 2, 3]).buffer };

  function prepareExport(): HTMLElement {
    const normalized = createAudioBuffer();
    vi.stubGlobal('OfflineAudioContext', vi.fn(() => ({ createBuffer: vi.fn(() => normalized) })));
    mediabunny.BufferTarget.mockImplementation(() => target);
    mediabunny.Output.mockImplementation(() => output);
    mediabunny.CanvasSource.mockImplementation(() => videoSource);
    mediabunny.AudioBufferSource.mockImplementation(() => audioSource);
    capture.toCanvas.mockResolvedValue(document.createElement('canvas'));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    const card = document.createElement('div');
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({ width: 360, height: 180 } as DOMRect);
    return card;
  }

  beforeEach(() => {
    mediabunny.canEncodeVideo.mockResolvedValue(true);
    mediabunny.canEncodeAudio.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

  it('30fpsでフレームと音声を追加して MP4 Blob を返す', async () => {
    const card = prepareExport();
    let encoding = false;
    videoSource.add.mockImplementation(async () => {
      expect(encoding).toBe(false);
      encoding = true;
      await Promise.resolve();
      encoding = false;
    });

    const result = await exportPlayerVideo({
      card,
      range,
      audio: createAudioBuffer(),
      volume: 1,
      onFrame: vi.fn(() => Promise.resolve()),
    });

    expect(videoSource.add).toHaveBeenCalledTimes(30);
    expect(videoSource.add).toHaveBeenNthCalledWith(1, 0, 1 / 30);
    const lastFrame = videoSource.add.mock.calls[29];
    expect(lastFrame[0]).toBeCloseTo(29 / 30);
    expect(lastFrame[1]).toBeCloseTo(1 / 30);
    expect(audioSource.add).toHaveBeenCalledOnce();
    expect(output.finalize).toHaveBeenCalledOnce();
    expect(output.cancel).not.toHaveBeenCalled();
    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('video/mp4');
  });

  it('フォント描画の準備が完了してから最初のフレームを生成する', async () => {
    const card = prepareExport();
    let resolveFonts: (() => void) | undefined;
    const fontsReady = new Promise<void>((resolve) => { resolveFonts = resolve; });
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: fontsReady } });
    const onFrame = vi.fn(() => Promise.resolve());
    const exportPromise = exportPlayerVideo({ card, range, audio: createAudioBuffer(), volume: 1, onFrame });

    await Promise.resolve();
    expect(onFrame).not.toHaveBeenCalled();
    resolveFonts?.();
    await exportPromise;
    expect(onFrame).toHaveBeenCalled();
  });

  it('フレーム取得中に中断されると後続のフレームを追加せず出力を取り消す', async () => {
    const card = prepareExport();
    const controller = new AbortController();
    capture.toCanvas.mockImplementation(async () => {
      controller.abort();
      return document.createElement('canvas');
    });

    await expect(exportPlayerVideo({
      card,
      range,
      audio: createAudioBuffer(),
      volume: 1,
      onFrame: vi.fn(() => Promise.resolve()),
      signal: controller.signal,
    })).rejects.toThrow('動画の生成をキャンセルしました。');

    expect(videoSource.add).not.toHaveBeenCalled();
    expect(output.cancel).toHaveBeenCalledOnce();
  });

  it('コーデック非対応なら出力開始前に日本語メッセージで拒否する', async () => {
    const card = prepareExport();
    mediabunny.canEncodeVideo.mockResolvedValue(false);

    await expect(exportPlayerVideo({
      card,
      range,
      audio: createAudioBuffer(),
      volume: 1,
      onFrame: vi.fn(() => Promise.resolve()),
    })).rejects.toThrow('H.264 映像エンコーダーに対応していないブラウザです。');

    expect(mediabunny.Output).not.toHaveBeenCalled();
  });

  it('通常のフレーム生成失敗でも出力を取り消す', async () => {
    const card = prepareExport();
    capture.toCanvas.mockRejectedValue(new Error('capture failed'));

    await expect(exportPlayerVideo({
      card,
      range,
      audio: createAudioBuffer(),
      volume: 1,
      onFrame: vi.fn(() => Promise.resolve()),
    })).rejects.toThrow('capture failed');

    expect(output.cancel).toHaveBeenCalledOnce();
  });
});
