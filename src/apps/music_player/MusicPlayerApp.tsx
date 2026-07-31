import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { useCapture } from '../../shared/capture/useCapture';
import { ThemeToggle } from '../../shared/theme/ThemeToggle';
import { useTheme } from '../../shared/theme/ThemeContext';
import { useYouTubePlayer } from '../../shared/youtube/useYouTubePlayer';
import { extractYouTubeId } from '../../shared/youtube/youtube';
import { NextIcon, PauseIcon, PlayIcon, PreviousIcon, VolumeHighIcon } from './icons';
import './music-player.css';

// 外部プレースホルダーサービスに依存しないよう、デフォルトカバーはインライン SVG
const DEFAULT_COVER = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#29243d"/>
      <stop offset="1" stop-color="#15131f"/>
    </linearGradient>
  </defs>
  <rect width="300" height="300" fill="url(#g)"/>
  <g fill="rgba(255,255,255,0.52)" transform="translate(150 150) scale(4.2) translate(-12 -12)">
    <path d="M9 18V5l12-2v13" fill="none" stroke="rgba(255,255,255,0.52)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="6" cy="18" r="3"/>
    <circle cx="18" cy="16" r="3"/>
  </g>
</svg>`);

const THEME_COLORS = {
  dark: { bgColor: '#1a1825', pointColor: '#7c6af0', textColor: '#e2e2ea' },
  light: { bgColor: '#f1efff', pointColor: '#6756df', textColor: '#252332' },
};

interface AppliedCard {
  title: string;
  artist: string;
  copyright: string;
  cover: string;
  bgColor: string;
  pointColor: string;
  textColor: string;
}

export default function MusicPlayerApp() {
  const { theme } = useTheme();

  // ---- フォーム入力 ----
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [copyright, setCopyright] = useState('');
  const [youtube, setYoutube] = useState('');
  const [colors, setColors] = useState(THEME_COLORS.dark);
  const uploadedImageRef = useRef<string | null>(null);

  // ---- 適用済みプレビュー ----
  const [applied, setApplied] = useState<AppliedCard>({
    title: '曲のタイトル',
    artist: 'アーティスト名',
    copyright: 'ⓒ 出典',
    cover: DEFAULT_COVER,
    ...THEME_COLORS.dark,
  });
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(50);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const { capture, capturing } = useCapture();

  const yt = useYouTubePlayer({
    width: '1',
    height: '1',
    playerVars: { autoplay: 0, controls: 0, playsinline: 1 },
    onStateChange: state => {
      if (!window.YT) return;
      if (state === window.YT.PlayerState.ENDED) {
        setPlaying(false);
        setProgress(0);
      }
    },
    onProgress: (currentTime, duration) => {
      if (duration > 0) {
        setProgress((currentTime / duration) * 100);
      }
    },
  });

  function applyPreview(nextColors = colors) {
    const youtubeId = extractYouTubeId(youtube);
    setApplied({
      title: title || '曲のタイトル',
      artist: artist || 'アーティスト名',
      copyright: copyright || 'ⓒ 出典',
      cover: uploadedImageRef.current || DEFAULT_COVER,
      bgColor: nextColors.bgColor,
      pointColor: nextColors.pointColor,
      textColor: nextColors.textColor,
    });

    if (youtubeId) {
      yt.cueVideo(youtubeId);
      setPlaying(false);
    }
  }

  // テーマ切替時: カラーピッカーをテーマ既定色に戻し、プレビューへ即反映(旧 setTheme の挙動)
  const applyPreviewRef = useRef(applyPreview);
  applyPreviewRef.current = applyPreview;
  useEffect(() => {
    const nextColors = THEME_COLORS[theme];
    setColors(nextColors);
    applyPreviewRef.current(nextColors);
  }, [theme]);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { uploadedImageRef.current = String(reader.result); };
    reader.readAsDataURL(file);
  }

  function handlePlayClick() {
    if (!yt.ready) {
      alert('まず[適用してプレビュー]を押して音楽を設定してください！');
      return;
    }
    if (playing) {
      yt.pause();
      setPlaying(false);
    } else {
      yt.play();
      setPlaying(true);
    }
  }

  function handleProgressInput(event: ChangeEvent<HTMLInputElement>) {
    const value = Number(event.target.value);
    setProgress(value);
    yt.seekToPercent(value);
  }

  function handleVolumeInput(event: ChangeEvent<HTMLInputElement>) {
    const value = Number(event.target.value);
    setVolume(value);
    yt.setVolume(value);
  }

  function handleCapture() {
    capture(cardRef.current, 'my_custom_player.png').catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      alert(message);
    });
  }

  const cardStyle = {
    '--player-bg': applied.bgColor,
    '--player-point': applied.pointColor,
    '--player-text': applied.textColor,
  } as CSSProperties;

  return (
    <div className="app-music">
      <div
        id="youtube-audio"
        className="pointer-events-none fixed -left-0.5 -top-0.5 h-px w-px overflow-hidden"
        ref={yt.containerRef}
      />

      <div className="maker-layout relative flex min-h-screen w-full max-w-[1500px] mx-auto items-center justify-center pr-[340px] max-md:flex-col max-md:px-4 max-md:py-6 max-md:gap-4 max-md:min-h-0 max-md:justify-start">

        {/* ---- Center: Player preview ---- */}
        <div id="capture-area" className="flex w-full justify-center max-md:w-auto">
          <div className="player-card" id="player-card" ref={cardRef} style={cardStyle}>

            {/* Cover art */}
            <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-2xl" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
              <div
                id="cover-img"
                className="absolute inset-0 h-full w-full bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url('${applied.cover}')` }}
              />
              {/* Subtle overlay gradient at bottom */}
              <div
                className="absolute bottom-0 left-0 right-0 h-12"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)' }}
              />
            </div>

            {/* Copyright */}
            <div className="mb-3 text-right text-[10px] opacity-40" id="copyright-text" style={{ color: 'var(--player-text)' }}>
              {applied.copyright}
            </div>

            {/* Song info */}
            <div className="mb-4" style={{ color: 'var(--player-text)' }}>
              <div className="text-base font-bold mb-0.5 leading-tight" id="song-title">{applied.title}</div>
              <div className="text-[12px] opacity-50" id="song-artist">{applied.artist}</div>
            </div>

            {/* Progress slider */}
            <div className="slider-wrap mb-1" id="progress-wrap">
              <div className="slider-track" />
              <div className="slider-fill" id="progress-fill" style={{ width: `${progress}%` }} />
              <div className="slider-thumb" id="progress-thumb" style={{ left: `${progress}%` }} />
              <input
                className="slider-input"
                type="range"
                id="progress-slider"
                value={progress}
                min="0"
                max="100"
                onChange={handleProgressInput}
                aria-label="再生位置"
              />
            </div>
            <div className="flex justify-between text-[10px] opacity-30 mb-4" style={{ color: 'var(--player-text)' }}>
              <span>0:00</span><span>—</span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-7 mb-4">
              <button className="ctrl-btn w-6 h-6" type="button" aria-label="前へ">
                <PreviousIcon className="block h-full w-full" />
              </button>
              <button className="ctrl-btn ctrl-btn-play" type="button" id="btn-play" aria-label="再生と一時停止" onClick={handlePlayClick}>
                {playing ? (
                  <span className="flex h-5 w-5" id="icon-pause">
                    <PauseIcon className="block h-full w-full" />
                  </span>
                ) : (
                  <span className="flex h-5 w-5 ml-0.5" id="icon-play">
                    <PlayIcon className="block h-full w-full" />
                  </span>
                )}
              </button>
              <button className="ctrl-btn w-6 h-6" type="button" aria-label="次へ">
                <NextIcon className="block h-full w-full" />
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2.5">
              <span className="ctrl-btn w-4 h-4 shrink-0">
                <svg viewBox="0 0 24 24" className="block h-full w-full fill-current" aria-hidden="true">
                  <path d="M13 4.6v14.8c0 .7-.83 1.07-1.35.6L7.2 16H4.5A1.5 1.5 0 0 1 3 14.5v-5A1.5 1.5 0 0 1 4.5 8h2.7l4.45-4c.52-.47 1.35-.1 1.35.6z" />
                </svg>
              </span>
              <div className="slider-wrap flex-1">
                <div className="slider-track" />
                <div className="slider-fill" id="volume-fill" style={{ width: `${volume}%` }} />
                <div className="slider-thumb" id="volume-thumb" style={{ left: `${volume}%` }} />
                <input
                  className="slider-input"
                  type="range"
                  id="volume-slider"
                  value={volume}
                  min="0"
                  max="100"
                  onChange={handleVolumeInput}
                  aria-label="音量"
                />
              </div>
              <span className="ctrl-btn w-4 h-4 shrink-0">
                <VolumeHighIcon className="block h-full w-full" />
              </span>
            </div>

          </div>
        </div>

        {/* ---- Right panel (controls) ---- */}
        <div className="glass-panel side-panel input-section absolute inset-y-0 right-0 flex flex-col w-[320px] p-6 overflow-y-auto max-md:static max-md:w-full max-md:max-w-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#7c6af0]" />
              <h2 className="panel-title text-sm font-semibold tracking-wide uppercase">Music Player</h2>
            </div>
            <ThemeToggle className="theme-toggle" />
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="field-label" htmlFor="in-title">Title</label>
              <input className="field-input" type="text" id="in-title" placeholder="タイトルまたはキャッチフレーズ" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="in-artist">Artist</label>
              <input className="field-input" type="text" id="in-artist" placeholder="アーティスト名" value={artist} onChange={e => setArtist(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="in-image">Cover Image</label>
              <input className="file-input" type="file" id="in-image" accept="image/*" onChange={handleImageChange} />
            </div>
            <div>
              <label className="field-label" htmlFor="in-youtube">YouTube URL</label>
              <input className="field-input" type="text" id="in-youtube" placeholder="例: https://www.youtube.com/watch?v=w2-uvGZCe3g" value={youtube} onChange={e => setYoutube(e.target.value)} />
              <p className="help-text text-[11px] mt-1.5">動画の URL を貼り付けてください</p>
            </div>
            <div>
              <label className="field-label" htmlFor="in-copyright">Copyright</label>
              <input className="field-input" type="text" id="in-copyright" placeholder="ⓒ 依頼主" value={copyright} onChange={e => setCopyright(e.target.value)} />
            </div>
          </div>

          <hr className="divider" />

          {/* Color pickers */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="field-label" htmlFor="in-bg-color">BG</label>
              <div className="color-picker-wrap">
                <input type="color" id="in-bg-color" value={colors.bgColor} onChange={e => setColors({ ...colors, bgColor: e.target.value })} />
              </div>
            </div>
            <div className="flex-1">
              <label className="field-label" htmlFor="in-point-color">Accent</label>
              <div className="color-picker-wrap">
                <input type="color" id="in-point-color" value={colors.pointColor} onChange={e => setColors({ ...colors, pointColor: e.target.value })} />
              </div>
            </div>
            <div className="flex-1">
              <label className="field-label" htmlFor="in-text-color">Text</label>
              <div className="color-picker-wrap">
                <input type="color" id="in-text-color" value={colors.textColor} onChange={e => setColors({ ...colors, textColor: e.target.value })} />
              </div>
            </div>
          </div>

          <hr className="divider" />

          <div className="flex flex-col gap-2.5">
            <button className="btn-primary btn-apply" id="btn-update" type="button" onClick={() => applyPreview()}>適用してプレビュー</button>
            <button className="btn-primary btn-save" id="btn-capture" type="button" onClick={handleCapture} disabled={capturing}>
              {capturing ? '画像を生成中…' : '画像として保存'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
