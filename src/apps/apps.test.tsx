import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { ThemeProvider } from '../shared/theme/ThemeContext';
import SpotifyPlayerApp from './spotify_player/SpotifyPlayerApp';
import MusicPlayerApp from './music_player/MusicPlayerApp';
import AppleMusicPlayerApp from './apple_music_player/AppleMusicPlayerApp';
import YoutubeMusicPlayerApp from './youtube_music_player/YoutubeMusicPlayerApp';
import InstagramReelApp from './instagram_reel/InstagramReelApp';

vi.mock('html-to-image', () => ({
  toPng: vi.fn(async () => 'data:image/png;base64,'),
}));

function renderApp(app: ReactNode) {
  return render(<ThemeProvider>{app}</ThemeProvider>);
}

describe('SpotifyPlayerApp', () => {
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
  });
});

describe('AppleMusicPlayerApp', () => {
  test('テーマ既定色でカードを初期化する', () => {
    renderApp(<AppleMusicPlayerApp />);

    const bgPicker = document.getElementById('in-bg-color') as HTMLInputElement;
    expect(bgPicker.value).toBe('#8e3b52');
    expect(document.getElementById('copyright-text')).toHaveTextContent('ⓒ 出典');
  });
});

describe('YoutubeMusicPlayerApp', () => {
  test('テーマ既定色でカードを初期化する', () => {
    renderApp(<YoutubeMusicPlayerApp />);

    const bgPicker = document.getElementById('in-bg-color') as HTMLInputElement;
    expect(bgPicker.value).toBe('#030303');
    expect(document.getElementById('time-total')).toHaveTextContent('-:--');
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
