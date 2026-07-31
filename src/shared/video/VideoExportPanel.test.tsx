import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RefObject } from 'react';
import type { LocalAudioState, PlayerFrameState } from './video-types';

const exporter = vi.hoisted(() => ({
  exportPlayerVideo: vi.fn(),
}));
const capability = vi.hoisted(() => ({ detectVideoCapabilities: vi.fn(async () => ({ supported: true, video: true, audio: true, message: '' })) }));

vi.mock('./video-exporter', () => exporter);
vi.mock('./video-capabilities', () => capability);

import { VideoExportPanel } from './VideoExportPanel';

const frameState: PlayerFrameState = {
  currentTime: 80,
  duration: 120,
  progress: 2 / 3,
  playing: false,
  volume: 0.7,
};

function createAudio(overrides: Partial<LocalAudioState> = {}): LocalAudioState {
  return {
    file: null,
    buffer: null,
    duration: 120,
    currentTime: 80,
    playing: false,
    volume: 0.7,
    error: '',
    ...overrides,
  };
}

function renderPanel(overrides: Partial<React.ComponentProps<typeof VideoExportPanel>> = {}) {
  const card = document.createElement('section');
  vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({ width: 360, height: 640 } as DOMRect);
  const exportCardRef = { current: card } as RefObject<HTMLElement | null>;
  const onAudioFileChange = vi.fn();
  const onSeek = vi.fn();
  const onFrame = vi.fn(() => Promise.resolve());
  const onVolumeChange = vi.fn();
  const onImageSave = vi.fn();

  render(
    <VideoExportPanel
      appId="music_player"
      exportCardRef={exportCardRef}
      audio={createAudio()}
      onAudioFileChange={onAudioFileChange}
      frameState={frameState}
      duration={120}
      currentTime={80}
      onSeek={onSeek}
      onFrame={onFrame}
      volume={0.7}
      onVolumeChange={onVolumeChange}
      onImageSave={onImageSave}
      {...overrides}
    />,
  );

  return { onAudioFileChange, onSeek, onFrame, onVolumeChange, onImageSave };
}

describe('VideoExportPanel', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('画像タブを初期表示し、既存の画像保存コールバックを実行する', async () => {
    const user = userEvent.setup();
    const { onImageSave } = renderPanel();

    expect(screen.getByRole('tab', { name: '画像' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: '画像として保存' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: '画像として保存' }));

    expect(onImageSave).toHaveBeenCalledOnce();
  });

  it('画像保存中は保存ボタンを無効化して二重実行を防ぐ', async () => {
    const user = userEvent.setup();
    let finishSave: (() => void) | undefined;
    const onImageSave = vi.fn(() => new Promise<void>((resolve) => { finishSave = resolve; }));
    renderPanel({ onImageSave });

    const saveButton = screen.getByRole('button', { name: '画像として保存' });
    await user.click(saveButton);

    expect(onImageSave).toHaveBeenCalledOnce();
    expect(saveButton).toBeDisabled();
    await user.click(saveButton);
    expect(onImageSave).toHaveBeenCalledOnce();

    finishSave?.();
    await waitFor(() => expect(saveButton).toBeEnabled());
  });

  it('動画タブでローカル音源、開始位置、出力範囲とYouTube対象外の説明を表示する', async () => {
    const user = userEvent.setup();
    const { onAudioFileChange, onSeek } = renderPanel({ audio: createAudio({ duration: 95 }) });

    await user.click(screen.getByRole('tab', { name: '動画' }));

    expect(screen.getByLabelText('ローカル音源（動画用）')).toHaveAttribute('accept', 'audio/*');
    expect(screen.getByLabelText('動画開始位置（m:ss）')).toHaveValue('1:20');
    expect(screen.getByLabelText('動画開始位置スライダー')).toHaveAttribute('step', '1');
    expect(screen.getByText('出力範囲: 1:20–1:35')).toBeInTheDocument();
    expect(screen.getByText('YouTube音声は動画へ出力されません')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('動画開始位置（m:ss）'));
    await user.type(screen.getByLabelText('動画開始位置（m:ss）'), '1:30');
    expect(onSeek).toHaveBeenLastCalledWith(90);

    const file = new File(['audio'], 'sample.wav', { type: 'audio/wav' });
    await user.upload(screen.getByLabelText('ローカル音源（動画用）'), file);
    expect(onAudioFileChange).toHaveBeenCalledWith(file);
  });

  it('音源をデコードするまでMP4保存を無効化する', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('tab', { name: '動画' }));

    expect(screen.getByRole('button', { name: 'MP4として保存' })).toBeDisabled();
    expect(screen.getByText('動画出力にはローカル音源を選択してください。')).toBeInTheDocument();
  });

  it('範囲プレビュー中はMP4保存を無効化する', async () => {
    const user = userEvent.setup();
    const onPreviewStart = vi.fn();
    renderPanel({
      audio: createAudio({
        file: new File(['audio'], 'sample.wav', { type: 'audio/wav' }),
        buffer: { duration: 120 } as AudioBuffer,
      }),
      onPreviewStart,
    });

    await user.click(screen.getByRole('tab', { name: '動画' }));
    const previewButton = screen.getByRole('button', { name: '動画をプレビュー' });
    await user.click(previewButton);

    expect(onPreviewStart).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'MP4として保存' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'プレビューを停止' })).toBeEnabled();
  });

  it('エンコーダー非対応の失敗を表示し、同じ入力で再試行できる', async () => {
    const user = userEvent.setup();
    const buffer = { duration: 120 } as AudioBuffer;
    exporter.exportPlayerVideo.mockRejectedValueOnce(new Error('H.264 映像エンコーダーに対応していないブラウザです。'));
    exporter.exportPlayerVideo.mockImplementationOnce(() => new Promise<Blob>(() => {}));
    renderPanel({ audio: createAudio({ buffer }) });

    await user.click(screen.getByRole('tab', { name: '動画' }));
    await user.click(screen.getByRole('button', { name: 'MP4として保存' }));

    expect(await screen.findByText('H.264 映像エンコーダーに対応していないブラウザです。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'もう一度生成' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'もう一度生成' }));
    await waitFor(() => expect(exporter.exportPlayerVideo).toHaveBeenCalledTimes(2));
  });

  it('生成中は進捗とキャンセルを表示し、画像タブを含む操作を無効化する', async () => {
    const user = userEvent.setup();
    const buffer = { duration: 120 } as AudioBuffer;
    exporter.exportPlayerVideo.mockImplementationOnce((options) => {
      options.onProgress?.('rendering', 0.5);
      return new Promise<Blob>((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(new Error('動画の生成をキャンセルしました。')));
      });
    });
    const { onImageSave } = renderPanel({ audio: createAudio({ buffer }) });

    await user.click(screen.getByRole('tab', { name: '動画' }));
    await user.click(screen.getByRole('button', { name: 'MP4として保存' }));

    expect(await screen.findByText('フレーム生成中（50%）')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeEnabled();
    expect(screen.getByRole('tab', { name: '画像' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'MP4として保存' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(exporter.exportPlayerVideo.mock.calls[0][0].signal.aborted).toBe(true);
    expect(onImageSave).not.toHaveBeenCalled();
    expect(await screen.findByText('動画の生成をキャンセルしました。')).toBeInTheDocument();
  });
});
