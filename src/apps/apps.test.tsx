import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { ThemeProvider } from '../shared/theme/ThemeContext';
import SpotifyPlayerApp from './spotify_player/SpotifyPlayerApp';
import MusicPlayerApp from './music_player/MusicPlayerApp';
import AppleMusicPlayerApp from './apple_music_player/AppleMusicPlayerApp';
import YoutubeMusicPlayerApp from './youtube_music_player/YoutubeMusicPlayerApp';
import InstagramReelApp from './instagram_reel/InstagramReelApp';

const captureSnap = vi.hoisted(() => vi.fn());
const download = vi.hoisted(() => vi.fn<() => Promise<void>>());

vi.mock('@zumer/snapdom', () => ({
  snapdom: captureSnap,
}));

beforeEach(() => {
  download.mockReset();
  download.mockResolvedValue(undefined);
  captureSnap.mockReset();
  captureSnap.mockResolvedValue({
    toCanvas: vi.fn().mockResolvedValue(document.createElement('canvas')),
    download,
  });
});

function renderApp(app: ReactNode) {
  return render(<ThemeProvider>{app}</ThemeProvider>);
}

describe('SpotifyPlayerApp', () => {
  test('主要なフォームとプレビュー要素を描画する', () => {
    renderApp(<SpotifyPlayerApp />);

    for (const label of ['Title', 'Artist', 'Artwork', 'Position', 'Duration', 'YouTube URL']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'トリミングを調整' })).toBeDisabled();
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
});

describe('MusicPlayerApp', () => {
  test('フォームとカードを描画し、適用でタイトルが反映される', async () => {
    const user = userEvent.setup();
    renderApp(<MusicPlayerApp />);

    await user.type(screen.getByLabelText('Title'), 'グラスの曲');
    await user.click(screen.getByRole('button', { name: '適用してプレビュー' }));

    expect(document.getElementById('song-title')).toHaveTextContent('グラスの曲');
    expect(document.getElementById('player-card')).not.toBeNull();
    expect(screen.getByRole('button', { name: '再生と一時停止' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'トリミングを調整' })).toBeDisabled();
  });

  test('画像をアップロードして適用しても未調整なら中央coverを維持する', async () => {
    const user = userEvent.setup();
    renderApp(<MusicPlayerApp />);

    await user.upload(
      screen.getByLabelText('Cover Image'),
      new File(['image'], 'cover.png', { type: 'image/png' }),
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'トリミングを調整' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: '適用してプレビュー' }));

    expect(document.getElementById('cover-img')).toHaveStyle({ backgroundSize: 'cover' });
  });
});

describe('AppleMusicPlayerApp', () => {
  test('テーマ既定色でカードを初期化する', () => {
    renderApp(<AppleMusicPlayerApp />);

    const bgPicker = document.getElementById('in-bg-color') as HTMLInputElement;
    expect(bgPicker.value).toBe('#8e3b52');
    expect(document.getElementById('copyright-text')).toHaveTextContent('ⓒ 出典');
    expect(screen.getByRole('button', { name: 'トリミングを調整' })).toBeDisabled();
  });
});

describe('YoutubeMusicPlayerApp', () => {
  test('テーマ既定色でカードを初期化する', () => {
    renderApp(<YoutubeMusicPlayerApp />);

    const bgPicker = document.getElementById('in-bg-color') as HTMLInputElement;
    expect(bgPicker.value).toBe('#030303');
    expect(document.getElementById('time-total')).toHaveTextContent('-:--');
    expect(screen.getByRole('button', { name: 'トリミングを調整' })).toBeDisabled();
  });
});

describe('InstagramReelApp', () => {
  test('適用でユーザー名と音源名がカードへ反映される', async () => {
    const user = userEvent.setup();
    renderApp(<InstagramReelApp />);

    expect(screen.getByLabelText('Background Image')).toBeInTheDocument();
    expect(screen.getByLabelText('Icon Image')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'トリミングを調整' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'トリミングを調整' }).every(button => (button as HTMLButtonElement).disabled)).toBe(true);

    await user.type(screen.getByLabelText('Username'), 'claude_dev');
    await user.click(screen.getByRole('button', { name: '適用してプレビュー' }));

    expect(document.getElementById('reel-username')).toHaveTextContent('claude_dev');
    expect(document.getElementById('reel-audio-name')).toHaveTextContent('claude_dev・オリジナル音源');
  });
});

describe('画像保存ボタン', () => {
  test.each([
    ['MusicPlayerApp', () => <MusicPlayerApp />],
    ['AppleMusicPlayerApp', () => <AppleMusicPlayerApp />],
    ['YoutubeMusicPlayerApp', () => <YoutubeMusicPlayerApp />],
    ['InstagramReelApp', () => <InstagramReelApp />],
    ['SpotifyPlayerApp', () => <SpotifyPlayerApp />],
  ])('%sは保存中の再押下を無効化する', async (_name, createApp) => {
    let resolveDownload!: () => void;
    const downloadPromise = new Promise<void>(resolve => { resolveDownload = resolve; });
    download.mockReturnValueOnce(downloadPromise);
    const user = userEvent.setup();
    renderApp(createApp());

    const button = screen.getByRole('button', { name: '画像として保存' });
    await user.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('画像を生成中…');

    resolveDownload();
    await waitFor(() => {
      expect(button).not.toBeDisabled();
      expect(button).toHaveTextContent('画像として保存');
    });
  });
});

describe('Spotify保存ステータス', () => {
  test('成功時は保存操作の開始を表示し、ボタンを戻す', async () => {
    const user = userEvent.setup();
    renderApp(<SpotifyPlayerApp />);
    const button = screen.getByRole('button', { name: '画像として保存' });

    await user.click(button);

    await waitFor(() => expect(screen.getByText('保存操作を開始しました')).toBeInTheDocument());
    expect(button).not.toBeDisabled();
    expect(button).toHaveTextContent('画像として保存');
  });

  test('失敗時は再試行方法を含むエラーを表示し、ボタンを戻す', async () => {
    download.mockRejectedValueOnce(new Error('renderer failed'));
    const user = userEvent.setup();
    renderApp(<SpotifyPlayerApp />);
    const button = screen.getByRole('button', { name: '画像として保存' });

    await user.click(button);

    await waitFor(() => expect(screen.getByText('画像を生成できませんでした。ページを再読み込みして、もう一度お試しください。')).toBeInTheDocument());
    expect(button).not.toBeDisabled();
    expect(button).toHaveTextContent('画像として保存');
  });
});
