import { toCanvas } from 'html-to-image';
import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
} from 'mediabunny';
import { detectVideoCapabilities } from './video-capabilities';
import { calculateVideoOutputHeight } from './video-timeline';
import type { PlayerFrameState, VideoClipRange } from './video-types';

export type VideoExportPhase = 'idle' | 'preparing' | 'rendering' | 'muxing' | 'completed' | 'failed' | 'cancelled';

export interface VideoExportOptions {
  card: HTMLElement;
  range: VideoClipRange;
  audio: AudioBuffer;
  volume: number;
  onFrame: (state: PlayerFrameState) => Promise<void>;
  onProgress?: (phase: VideoExportPhase, progress: number) => void;
  signal?: AbortSignal;
}

const OUTPUT_WIDTH = 1080;
const FRAME_RATE = 30;
const VIDEO_BITRATE = 8_000_000;
const AUDIO_BITRATE = 128_000;
const AUDIO_SAMPLE_RATE = 48_000;

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('動画の生成をキャンセルしました。');
}

function clampVolume(volume: number): number {
  return Number.isFinite(volume) ? Math.min(Math.max(volume, 0), 1) : 1;
}

export function trimAndNormalizeAudio(audio: AudioBuffer, range: VideoClipRange, volume: number): AudioBuffer {
  if (!Number.isFinite(range.start) || !Number.isFinite(range.duration) || range.start < 0 || range.duration <= 0) {
    throw new Error('音声の切り出し範囲が不正です。');
  }

  const numberOfChannels = Math.min(Math.max(audio.numberOfChannels, 1), 2);
  const length = Math.max(1, Math.ceil(range.duration * AUDIO_SAMPLE_RATE));
  const context = new OfflineAudioContext(numberOfChannels, length, AUDIO_SAMPLE_RATE);
  const normalized = context.createBuffer(numberOfChannels, length, AUDIO_SAMPLE_RATE);
  const gain = clampVolume(volume);

  for (let channel = 0; channel < numberOfChannels; channel += 1) {
    const source = audio.getChannelData(Math.min(channel, audio.numberOfChannels - 1));
    const destination = normalized.getChannelData(channel);

    for (let frame = 0; frame < length; frame += 1) {
      const sourcePosition = (range.start + frame / AUDIO_SAMPLE_RATE) * audio.sampleRate;
      const left = Math.floor(sourcePosition);
      const right = Math.min(left + 1, source.length - 1);
      const fraction = sourcePosition - left;
      const leftSample = source[Math.min(Math.max(left, 0), source.length - 1)] ?? 0;
      const rightSample = source[Math.min(Math.max(right, 0), source.length - 1)] ?? 0;
      destination[frame] = (leftSample + (rightSample - leftSample) * fraction) * gain;
    }
  }

  return normalized;
}

function getFrameState(audio: AudioBuffer, range: VideoClipRange, frameIndex: number, volume: number): PlayerFrameState {
  const currentTime = Math.min(range.start + frameIndex / FRAME_RATE, range.end);
  return {
    currentTime,
    duration: audio.duration,
    progress: audio.duration > 0 ? currentTime / audio.duration : 0,
    playing: true,
    volume: clampVolume(volume),
  };
}

function getOutputSize(card: HTMLElement): { width: number; height: number } {
  const rect = card.getBoundingClientRect();
  const height = calculateVideoOutputHeight(rect.width, rect.height, OUTPUT_WIDTH);
  if (height <= 0) throw new Error('カードのサイズを取得できませんでした。');

  return { width: OUTPUT_WIDTH, height };
}

function copyCanvasFrame(target: HTMLCanvasElement, source: HTMLCanvasElement, width: number, height: number): void {
  target.width = width;
  target.height = height;
  const context = target.getContext('2d');
  if (!context) throw new Error('カードのフレームを生成できませんでした。');

  context.clearRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
}

export async function exportPlayerVideo(options: VideoExportOptions): Promise<Blob> {
  assertNotAborted(options.signal);
  options.onProgress?.('preparing', 0);

  const audio = trimAndNormalizeAudio(options.audio, options.range, options.volume);
  assertNotAborted(options.signal);

  const { width, height } = getOutputSize(options.card);
  const capabilities = await detectVideoCapabilities(width, height);
  if (!capabilities.supported) throw new Error(capabilities.message);

  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat(), target });
  let completed = false;

  try {
    const frameCount = Math.ceil(options.range.duration * FRAME_RATE);
    const encodingCanvas = document.createElement('canvas');
    const videoSource = new CanvasSource(encodingCanvas, {
      codec: 'avc',
      bitrate: VIDEO_BITRATE,
      transform: { width, height, frameRate: FRAME_RATE },
    });
    const audioSource = new AudioBufferSource({
      codec: 'aac',
      bitrate: AUDIO_BITRATE,
      transform: { numberOfChannels: audio.numberOfChannels, sampleRate: audio.sampleRate },
    });

    output.addVideoTrack(videoSource);
    output.addAudioTrack(audioSource);
    await output.start();

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      assertNotAborted(options.signal);
      await options.onFrame(getFrameState(options.audio, options.range, frameIndex, options.volume));
      assertNotAborted(options.signal);

      const frame = await toCanvas(options.card, { canvasWidth: width, canvasHeight: height });
      assertNotAborted(options.signal);
      copyCanvasFrame(encodingCanvas, frame, width, height);
      const timestamp = frameIndex / FRAME_RATE;
      await videoSource.add(timestamp, Math.min(1 / FRAME_RATE, options.range.duration - timestamp));
      options.onProgress?.('rendering', (frameIndex + 1) / frameCount);
    }

    assertNotAborted(options.signal);
    options.onProgress?.('muxing', 0);
    await audioSource.add(audio);
    await output.finalize();
    assertNotAborted(options.signal);

    if (!target.buffer) throw new Error('MP4 データを作成できませんでした。');
    options.onProgress?.('completed', 1);
    const blob = new Blob([target.buffer], { type: 'video/mp4' });
    completed = true;
    return blob;
  } finally {
    if (!completed) {
      try {
        await output.cancel();
      } catch {
        // 出力中の元の失敗をcancelの失敗で置き換えない
      }
    }
  }
}
