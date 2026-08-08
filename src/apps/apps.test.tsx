import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { ThemeProvider } from '../shared/theme/ThemeContext';

// CSSのレイアウト契約をNode標準APIで検証する(本番コードへNode型を追加しない)。
// @ts-expect-error Node型は本番TypeScript設定に含めない。
import { readFileSync } from 'node:fs';
import SpotifyPlayerApp from './spotify_player/SpotifyPlayerApp';
import AppleMusicPlayerApp from './apple_music_player/AppleMusicPlayerApp';
import YoutubeMusicPlayerApp from './youtube_music_player/YoutubeMusicPlayerApp';
import InstagramReelApp from './instagram_reel/InstagramReelApp';

const captureSnap = vi.hoisted(() => vi.fn());
const download = vi.hoisted(() => vi.fn<() => Promise<void>>());
const youtubeMusicCss = readFileSync('src/apps/youtube_music_player/youtube-music-player.css', 'utf8');

vi.mock('@zumer/snapdom', () => ({
  snapdom: captureSnap,
}));

beforeEach(() => {
  window.localStorage.clear();
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

  test('論理キャンバス全体を使い、旧固定カード比率の制約を持たない', () => {
    renderApp(<YoutubeMusicPlayerApp />);

    const card = document.getElementById('player-card');
    expect(card).toHaveClass('ym-card');
    expect(document.querySelector('.ym-song-info')).toBeInTheDocument();
    expect(document.querySelector('.ym-progress')).toBeInTheDocument();
    expect(document.querySelector('.ym-controls')).toBeInTheDocument();
    expect(document.querySelector('.ym-volume')).toBeInTheDocument();
    expect(youtubeMusicCss).toMatch(/\.ym-card\s*\{[\s\S]*width:\s*100%;[\s\S]*height:\s*100%;/);
    expect(youtubeMusicCss).not.toMatch(/\.ym-card\s*\{[^}]*width:\s*340px/s);
    expect(youtubeMusicCss).not.toContain('var(--device-preview-height, 100cqh) - 386px');
    expect(youtubeMusicCss).toContain('border-radius: 0;');
  });

  test('Pixel 10 Pro XL選択時は論理448×997のまま1344×2992へ保存する', async () => {
    window.localStorage.clear();
    const user = userEvent.setup();
    renderApp(<YoutubeMusicPlayerApp />);

    await user.click(screen.getByRole('tab', { name: '端末プリセット' }));
    await user.selectOptions(screen.getByRole('combobox'), 'pixel-10-pro-xl');
    await user.click(screen.getByRole('button', { name: '画像として保存' }));
    await waitFor(() => expect(download).toHaveBeenCalledOnce());

    expect(captureSnap).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({
      width: 1344,
      height: 2992,
      dpr: 3,
    }));
    const [target] = captureSnap.mock.calls[0] as [HTMLElement, Record<string, unknown>];
    expect(target.style.width).toBe('448px');
    expect(target.style.height).toBe('997px');
    expect(target).toHaveAttribute('aria-hidden', 'true');
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

describe('正方形大型キャンバスのcontainer条件', () => {
  test.each([
    ['AppleMusicPlayerApp', () => <AppleMusicPlayerApp />, 'player-card'],
    ['YoutubeMusicPlayerApp', () => <YoutubeMusicPlayerApp />, 'player-card'],
    ['SpotifyPlayerApp', () => <SpotifyPlayerApp />, 'player-card'],
  ])('%sはカードをsize containerとして保存cloneと同じ条件で評価できる', (_name, createApp, cardId) => {
    renderApp(createApp());
    const card = document.getElementById(cardId) as HTMLElement;
    expect(card).toBeInTheDocument();
    expect(card.style.containerType).toBe('size');
    expect(card.closest('[data-device-canvas]')).toBeInTheDocument();
  });

  test.each([
    ['AppleMusicPlayerApp', () => <AppleMusicPlayerApp />, 'player-card'],
    ['YoutubeMusicPlayerApp', () => <YoutubeMusicPlayerApp />, 'player-card'],
    ['SpotifyPlayerApp', () => <SpotifyPlayerApp />, 'player-card'],
  ])('%sはpreview slot内でcapture cloneへ論理キャンバスサイズを渡す', (_name, createApp, cardId) => {
    renderApp(createApp());
    const card = document.getElementById(cardId) as HTMLElement;
    const canvas = card.closest('[data-device-canvas]') as HTMLElement;
    expect(card.closest('[data-device-preview-slot]')).toBeInTheDocument();
    expect(card.style.getPropertyValue('--device-preview-width')).toBe(`${canvas.dataset.outputWidth}px`);
    expect(card.style.getPropertyValue('--device-preview-height')).toBe(`${canvas.dataset.outputHeight}px`);
  });
});

describe('画像保存ボタン', () => {
  test.each([
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

  test('選択した論理サイズをSnapDOMへ渡し、編集パネルを保存対象に含めない', async () => {
    const user = userEvent.setup();
    renderApp(<InstagramReelApp />);
    await user.click(screen.getByRole('button', { name: '画像として保存' }));
    await waitFor(() => expect(download).toHaveBeenCalledOnce());
    expect(captureSnap).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({
      format: 'png',
      scale: 1,
      dpr: 1,
      width: expect.any(Number),
      height: expect.any(Number),
    }));
    const [target] = captureSnap.mock.calls[0] as [HTMLElement, Record<string, unknown>];
    expect(target).not.toBe(document.querySelector('.editor'));
    expect(target).not.toBe(document.querySelector('[data-device-toolbar]'));
  });
});
