import { lazy, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react';

export interface GeneratorDef {
  id: string;
  /** サイドバーに表示する名前 */
  name: string;
  /** サイドバーに表示する説明 */
  desc: string;
  /** document.title に設定する値(旧 各アプリ index.html の <title> を維持) */
  title: string;
  /** サイドバーアイコンの背景グラデーション */
  color: string;
  icon: ReactNode;
  Component: LazyExoticComponent<ComponentType>;
}

const musicIcon = (
  <svg viewBox="0 0 24 24">
    <path d="M9 18V5l12-2v13" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

export const GENERATORS: GeneratorDef[] = [
  {
    id: 'music_player',
    name: 'Music Player',
    desc: '汎用グラスデザイン',
    title: 'music player generator',
    color: 'linear-gradient(135deg, #7c6af0, #5b4fe0)',
    icon: musicIcon,
    Component: lazy(() => import('./apps/music_player/MusicPlayerApp')),
  },
  {
    id: 'apple_music_player',
    name: 'Apple Music',
    desc: 'Now Playing 風カード',
    title: 'apple music generator',
    color: 'linear-gradient(135deg, #fa2d48, #b91d33)',
    icon: musicIcon,
    Component: lazy(() => import('./apps/apple_music_player/AppleMusicPlayerApp')),
  },
  {
    id: 'youtube_music_player',
    name: 'YouTube Music',
    desc: 'ダークテーマ再生画面',
    title: 'youtube music generator',
    color: 'linear-gradient(135deg, #ff1a1a, #990000)',
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="none" stroke="#fff" strokeWidth="2" />
        <path d="M10 8.6v6.8c0 .5.55.8.97.53l5.2-3.4a.62.62 0 0 0 0-1.06l-5.2-3.4a.62.62 0 0 0-.97.53z" />
      </svg>
    ),
    Component: lazy(() => import('./apps/youtube_music_player/YoutubeMusicPlayerApp')),
  },
  {
    id: 'spotify_player',
    name: 'Spotify Style',
    desc: 'グリーンの Now Playing 風',
    title: 'Spotify style player generator',
    color: 'linear-gradient(135deg, #1DB954, #0b5425)',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M5 8.5c4.4-1.3 9.9-.9 13.6 1.1" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" />
        <path d="M6.1 12.6c3.7-1 8.2-.7 11.3.9" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
        <path d="M7 16.4c3-.8 6.5-.5 9 .7" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
    Component: lazy(() => import('./apps/spotify_player/SpotifyPlayerApp')),
  },
  {
    id: 'instagram_reel',
    name: 'Instagram Reel',
    desc: 'リール風 9:16 画像',
    title: 'instagram reel generator',
    color: 'linear-gradient(135deg, #833ab4, #fd1d1d 60%, #fcb045)',
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="#fff" strokeWidth="2" />
        <path d="M10 9.2v5.6c0 .5.55.8.97.53l4.3-2.8a.62.62 0 0 0 0-1.06l-4.3-2.8a.62.62 0 0 0-.97.53z" />
      </svg>
    ),
    Component: lazy(() => import('./apps/instagram_reel/InstagramReelApp')),
  },
];
