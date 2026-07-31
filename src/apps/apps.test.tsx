import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { ThemeProvider } from '../shared/theme/ThemeContext';
import SpotifyPlayerApp from './spotify_player/SpotifyPlayerApp';
import MusicPlayerApp from './music_player/MusicPlayerApp';
import AppleMusicPlayerApp from './apple_music_player/AppleMusicPlayerApp';
import YoutubeMusicPlayerApp from './youtube_music_player/YoutubeMusicPlayerApp';
import InstagramReelApp from './instagram_reel/InstagramReelApp';

const htmlToImage = vi.hoisted(() => ({ toPng: vi.fn(async () => 'data:image/png;base64,') }));

vi.mock('html-to-image', () => htmlToImage);

function renderApp(app: ReactNode) {
  return render(<ThemeProvider>{app}</ThemeProvider>);
}

describe('SpotifyPlayerApp', () => {
  let localAudio: { currentTime: number; duration: number; listeners: Map<string, () => void>; [key: string]: unknown };

  beforeEach(() => {
    localAudio = {
      currentTime: 0, duration: Number.NaN, volume: 1, src: '', play: vi.fn(() => Promise.resolve()), pause: vi.fn(),
      listeners: new Map<string, () => void>(),
      addEventListener: vi.fn((name: string, listener: () => void) => localAudio.listeners.set(name, listener)),
      removeEventListener: vi.fn((name: string) => localAudio.listeners.delete(name)), removeAttribute: vi.fn(), load: vi.fn(),
    };
    vi.stubGlobal('Audio', vi.fn(() => localAudio));
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:spotify-audio'), revokeObjectURL: vi.fn() });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test('主要なフォームとプレビュー要素を描画する', () => {
    renderApp(<SpotifyPlayerApp />);

    for (const label of ['Title', 'Artist', 'Artwork', 'Position', 'Duration', 'YouTube URL']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: '適用してプレビュー' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '画像として保存' })).toBeInTheDocument();
    expect(screen.getByText('静的プレビューモード')).toBeInTheDocument();
  });

  test('不正な Position はエラーを表示し、修正後の適用でカードへ反映される', async () => {
    const user = userEvent.setup();
    renderApp(<SpotifyPlayerApp />);

    const position = screen.getByLabelText('Position');
    await user.clear(position);
    await user.type(position, 'abc');
    await user.click(screen.getByRole('button', { name: '適用してプレビュー' }));

    expect(screen.getByText('m:ss 形式で入力してください')).toBeInTheDocument();
    expect(position).toHaveAttribute('aria-invalid', 'true');

    await user.clear(position);
    await user.type(position, '1:00');
    await user.type(screen.getByLabelText('Title'), 'テスト曲');
    await user.click(screen.getByRole('button', { name: '適用してプレビュー' }));

    expect(position).toHaveAttribute('aria-invalid', 'false');
    expect(document.getElementById('song-title')).toHaveTextContent('テスト曲');
    expect(document.getElementById('time-current')).toHaveTextContent('1:00');
  });

  test('静的な時刻を保ったまま動画タブでローカル音源を選択でき、PNG保存も表示する', async () => {
    const user = userEvent.setup();
    renderApp(<SpotifyPlayerApp />);

    await user.clear(screen.getByLabelText('Position'));
    await user.type(screen.getByLabelText('Position'), '1:05');
    await user.clear(screen.getByLabelText('Duration'));
    await user.type(screen.getByLabelText('Duration'), '2:30');
    await user.click(screen.getByRole('button', { name: '適用してプレビュー' }));

    expect(document.getElementById('time-current')).toHaveTextContent('1:05');
    expect(document.getElementById('time-total')).toHaveTextContent('2:30');
    expect(screen.getByRole('button', { name: '画像として保存' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '動画' }));
    const audioInput = screen.getByLabelText('ローカル音源（動画用）');
    await user.upload(audioInput, new File(['audio'], 'spotify.mp3', { type: 'audio/mpeg' }));

    expect(audioInput).toHaveAttribute('accept', 'audio/*');
    await waitFor(() => expect(screen.getByText('選択中: spotify.mp3')).toBeInTheDocument());
    localAudio.duration = 123;
    localAudio.currentTime = 45;
    act(() => {
      localAudio.listeners.get('loadedmetadata')?.();
      localAudio.listeners.get('timeupdate')?.();
    });

    await waitFor(() => expect(document.getElementById('time-current')).toHaveTextContent('0:45'));
    expect(document.getElementById('time-total')).toHaveTextContent('2:03');
    expect(screen.getByLabelText('動画開始位置スライダー')).toHaveAttribute('max', '123');
    expect(screen.getByText('YouTube音声は動画へ出力されません')).toBeInTheDocument();
  });
});

describe('MusicPlayerApp', () => {
  beforeEach(() => {
    vi.stubGlobal('Audio', vi.fn(() => ({
      currentTime: 0,
      duration: Number.NaN,
      volume: 1,
      src: '',
      play: vi.fn(() => Promise.resolve()),
      pause: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('フォームとカードを描画し、適用でタイトルが反映される', async () => {
    const user = userEvent.setup();
    renderApp(<MusicPlayerApp />);

    await user.type(screen.getByLabelText('Title'), 'グラスの曲');
    await user.click(screen.getByRole('button', { name: '適用してプレビュー' }));

    expect(document.getElementById('song-title')).toHaveTextContent('グラスの曲');
    expect(document.getElementById('player-card')).not.toBeNull();
    expect(screen.getByRole('button', { name: '再生と一時停止' })).toBeInTheDocument();
  });

  test('動画タブからローカル音源を選択でき、YouTube音源は動画対象外と案内する', async () => {
    const user = userEvent.setup();
    renderApp(<MusicPlayerApp />);

    expect(screen.getByRole('button', { name: '画像として保存' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '動画' }));

    expect(screen.getByLabelText('ローカル音源（動画用）')).toHaveAttribute('accept', 'audio/*');
    expect(screen.getByText('YouTube音声は動画へ出力されません')).toBeInTheDocument();
  });

  test('PNG生成が完了するまで共通パネルの保存ロックを維持する', async () => {
    const user = userEvent.setup();
    let finishCapture: (() => void) | undefined;
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    htmlToImage.toPng.mockImplementationOnce(() => new Promise<string>((resolve) => { finishCapture = () => resolve('data:image/png;base64,'); }));
    renderApp(<MusicPlayerApp />);

    const saveButton = screen.getByRole('button', { name: '画像として保存' });
    await user.click(saveButton);

    await waitFor(() => expect(htmlToImage.toPng).toHaveBeenCalledOnce());
    expect(saveButton).toBeDisabled();

    finishCapture?.();
    await waitFor(() => expect(saveButton).toBeEnabled());
    anchorClick.mockRestore();
  });
});

describe('AppleMusicPlayerApp', () => {
  beforeEach(() => {
    vi.stubGlobal('Audio', vi.fn(() => ({
      currentTime: 0, duration: Number.NaN, volume: 1, src: '', play: vi.fn(() => Promise.resolve()), pause: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), removeAttribute: vi.fn(), load: vi.fn(),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('テーマ既定色でカードを初期化する', () => {
    renderApp(<AppleMusicPlayerApp />);

    const bgPicker = document.getElementById('in-bg-color') as HTMLInputElement;
    expect(bgPicker.value).toBe('#8e3b52');
    expect(document.getElementById('copyright-text')).toHaveTextContent('ⓒ 出典');
  });

  test('動画タブでも既存のカードとYouTubeプレビュー操作を保持する', async () => {
    const user = userEvent.setup();
    renderApp(<AppleMusicPlayerApp />);

    expect(document.getElementById('player-card')).toHaveClass('am-card');
    expect(document.getElementById('cover-img')).toHaveClass('am-artwork');
    expect(document.getElementById('time-current')).toHaveTextContent('0:00');
    expect(screen.getByLabelText('音量')).toHaveValue('50');
    expect(screen.getByLabelText('YouTube URL')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '画像として保存' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '動画' }));

    expect(screen.getByLabelText('ローカル音源（動画用）')).toHaveAttribute('accept', 'audio/*');
    expect(screen.getByText('YouTube音声は動画へ出力されません')).toBeInTheDocument();
  });
});

describe('YoutubeMusicPlayerApp', () => {
  beforeEach(() => {
    vi.stubGlobal('Audio', vi.fn(() => ({
      currentTime: 0, duration: Number.NaN, volume: 1, src: '', play: vi.fn(() => Promise.resolve()), pause: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), removeAttribute: vi.fn(), load: vi.fn(),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('テーマ既定色でカードを初期化する', () => {
    renderApp(<YoutubeMusicPlayerApp />);

    const bgPicker = document.getElementById('in-bg-color') as HTMLInputElement;
    expect(bgPicker.value).toBe('#030303');
    expect(document.getElementById('time-total')).toHaveTextContent('-:--');
  });

  test('動画タブでも既存のカードとYouTubeプレビュー操作を保持する', async () => {
    const user = userEvent.setup();
    renderApp(<YoutubeMusicPlayerApp />);

    expect(document.getElementById('player-card')).toHaveClass('ym-card');
    expect(document.getElementById('cover-img')).toHaveClass('ym-artwork');
    expect(document.getElementById('time-total')).toHaveTextContent('-:--');
    expect(screen.getByLabelText('音量')).toHaveValue('50');
    expect(screen.getByLabelText('YouTube URL')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '画像として保存' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '動画' }));

    expect(screen.getByLabelText('ローカル音源（動画用）')).toHaveAttribute('accept', 'audio/*');
    expect(screen.getByText('YouTube音声は動画へ出力されません')).toBeInTheDocument();
  });
});

describe('InstagramReelApp', () => {
  test('適用でユーザー名と音源名がカードへ反映される', async () => {
    const user = userEvent.setup();
    renderApp(<InstagramReelApp />);

    await user.type(screen.getByLabelText('Username'), 'claude_dev');
    await user.click(screen.getByRole('button', { name: '適用してプレビュー' }));

    expect(document.getElementById('reel-username')).toHaveTextContent('claude_dev');
    expect(document.getElementById('reel-audio-name')).toHaveTextContent('claude_dev・オリジナル音源');
  });
});
