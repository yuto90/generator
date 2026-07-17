import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { useCapture } from '../../shared/capture/useCapture';
import { ThemeToggle } from '../../shared/theme/ThemeToggle';
import { useTheme } from '../../shared/theme/ThemeContext';
import { useYouTubePlayer } from '../../shared/youtube/useYouTubePlayer';
import { extractYouTubeId } from '../../shared/youtube/youtube';
import './youtube-music-player.css';

// 外部プレースホルダーサービスに依存しないよう、デフォルトカバーはインライン SVG
const DEFAULT_COVER = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="340" height="340" viewBox="0 0 340 340">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2e2222"/>
      <stop offset="1" stop-color="#141010"/>
    </linearGradient>
  </defs>
  <rect width="340" height="340" fill="url(#g)"/>
  <g fill="rgba(255,255,255,0.5)" transform="translate(170 170) scale(4.6) translate(-12 -12)">
    <path d="M9 18V5l12-2v13"/>
    <path d="M9 18V5l12-2v13" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="6" cy="18" r="3"/>
    <circle cx="18" cy="16" r="3"/>
  </g>
</svg>`);

const THEME_COLORS = {
  dark: { bgColor: '#030303', pointColor: '#ff0000', textColor: '#ffffff' },
  light: { bgColor: '#f4f4f4', pointColor: '#d60000', textColor: '#202020' },
};

// YT Music の Now Playing はほぼフラットな暗色背景。
// BG カラーを基準に上方向へわずかに明るいグラデーションを作る。
function shadeColor(hex: string, percent: number): string {
  const n = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, (n >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt));
  const b = Math.min(255, Math.max(0, (n & 0xff) + amt));
  return `rgb(${r}, ${g}, ${b})`;
}

function ymFormatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '-:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface AppliedCard {
  title: string;
  artist: string;
  copyright: string;
  cover: string;
  bgColor: string;
  pointColor: string;
  textColor: string;
}

export default function YoutubeMusicPlayerApp() {
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
  const [times, setTimes] = useState({ current: 0, duration: 0 });
  const [volume, setVolume] = useState(50);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const { capture } = useCapture();

  const yt = useYouTubePlayer({
    width: '1',
    height: '1',
    playerVars: { autoplay: 0, controls: 0, playsinline: 1 },
    onStateChange: state => {
      if (!window.YT) return;
      if (state === window.YT.PlayerState.ENDED) {
        setPlaying(false);
        setProgress(0);
        setTimes({ current: 0, duration: yt.getDuration() });
      }
    },
    onProgress: (currentTime, duration) => {
      if (duration > 0) {
        setProgress((currentTime / duration) * 100);
        setTimes({ current: currentTime, duration });
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
      setProgress(0);
      setTimes({ current: 0, duration: 0 });
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
    const duration = yt.getDuration();
    if (duration > 0) {
      yt.seekTo(duration * (value / 100));
      setTimes({ current: duration * (value / 100), duration });
    }
  }

  function handleVolumeInput(event: ChangeEvent<HTMLInputElement>) {
    const value = Number(event.target.value);
    setVolume(value);
    yt.setVolume(value);
  }

  function handleCapture() {
    capture(cardRef.current!, 'youtube_music_player.png').catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      alert('画像の生成に失敗しました: ' + message);
    });
  }

  const cardStyle = {
    background: `linear-gradient(180deg, ${shadeColor(applied.bgColor, 9)} 0%, ${applied.bgColor} 55%)`,
    color: applied.textColor,
    '--player-point': applied.pointColor,
    '--player-text': applied.textColor,
  } as CSSProperties;

  return (
    <div className="app-ytmusic">
      <div
        id="youtube-audio"
        className="pointer-events-none fixed -left-0.5 -top-0.5 h-px w-px overflow-hidden"
        ref={yt.containerRef}
      />

      <div className="maker-layout relative flex min-h-screen w-full max-w-[1500px] mx-auto items-center justify-center pr-[340px] max-md:flex-col max-md:px-4 max-md:py-6 max-md:gap-4 max-md:min-h-0 max-md:justify-start">

        {/* ---- Center: YouTube Music player preview ---- */}
        <div id="capture-area" className="flex w-full justify-center max-md:w-auto">
          <div className="ym-card" id="player-card" ref={cardRef} style={cardStyle}>

            {/* Top bar */}
            <div className="ym-topbar">
              <button className="ctrl-btn" type="button" aria-label="閉じる">
                <svg viewBox="0 0 24 24" fill="none"><path d="M5 9l7 7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <span className="text-[11px] font-medium tracking-[0.12em] uppercase opacity-60">再生中</span>
              <button className="ctrl-btn" type="button" aria-label="その他">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
              </button>
            </div>

            {/* Cover art */}
            <div id="cover-img" className="ym-artwork" style={{ backgroundImage: `url('${applied.cover}')` }} />

            {/* Song info */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 min-w-0">
                <div className="ym-title" id="song-title">{applied.title}</div>
                <div className="ym-artist" id="song-artist">{applied.artist}</div>
              </div>
              <button className="ctrl-btn ym-sub-btn w-5 h-5 shrink-0" type="button" aria-label="低評価">
                <svg viewBox="0 0 24 24"><path d="M15 3H6.5A2.5 2.5 0 0 0 4 5.5l-1.4 7A2.5 2.5 0 0 0 5.05 15H10l-.7 4.2A1.8 1.8 0 0 0 11.08 21c.5 0 .96-.26 1.22-.68L16 14.5V3h-1z" /><path d="M18 3h3v11h-3z" /></svg>
              </button>
              <button className="ctrl-btn ym-sub-btn w-5 h-5 shrink-0" type="button" aria-label="高評価">
                <svg viewBox="0 0 24 24"><path d="M9 21h8.5a2.5 2.5 0 0 0 2.5-2.5l1.4-7A2.5 2.5 0 0 0 18.95 9H14l.7-4.2A1.8 1.8 0 0 0 12.92 3c-.5 0-.96.26-1.22.68L8 9.5V21h1z" /><path d="M3 10h3v11H3z" /></svg>
              </button>
            </div>

            {/* Progress slider */}
            <div className="slider-wrap" id="progress-wrap">
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
            <div className="ym-times">
              <span id="time-current">{ymFormatTime(times.current)}</span>
              <span id="time-total">{times.duration > 0 ? ymFormatTime(times.duration) : '-:--'}</span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between mt-3 px-1">
              <button className="ctrl-btn ym-sub-btn w-5 h-5" type="button" aria-label="シャッフル">
                <svg viewBox="0 0 24 24"><path d="M17 4l3.3 3.3-3.3 3.3v-2.3h-1.9c-.9 0-1.7.4-2.2 1.1l-1.2 1.6-1.5-2 1.1-1.5A4.75 4.75 0 0 1 15.1 6H17V4zM3 6h3.9c1.5 0 2.9.7 3.8 1.9l4.2 5.6c.5.7 1.3 1.1 2.2 1.1H19v-2.3l3.3 3.3L19 18.9v-2.3h-1.9c-1.5 0-2.9-.7-3.8-1.9L9.1 9.1C8.6 8.4 7.8 8 6.9 8H3V6zm6 8.6l1.5 2-.4.5c-.9 1.2-2.3 1.9-3.8 1.9H3v-2h3.3c.9 0 1.7-.4 2.2-1.1l.5-.7z" /></svg>
              </button>
              <button className="ctrl-btn w-8 h-8" type="button" aria-label="前へ">
                <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zM18.5 6.6v10.8c0 .5-.56.8-.98.52l-8.1-5.4a.62.62 0 0 1 0-1.04l8.1-5.4c.42-.28.98.02.98.52z" /></svg>
              </button>
              <button className="ctrl-btn ym-play-btn" type="button" id="btn-play" aria-label="再生と一時停止" onClick={handlePlayClick}>
                {playing ? (
                  <span className="flex items-center justify-center h-full w-full" id="icon-pause">
                    <svg viewBox="0 0 24 24"><rect x="6" y="4.5" width="4.4" height="15" rx="0.8" /><rect x="13.6" y="4.5" width="4.4" height="15" rx="0.8" /></svg>
                  </span>
                ) : (
                  <span className="flex items-center justify-center h-full w-full" id="icon-play">
                    <svg viewBox="0 0 24 24"><path d="M8 5.8v12.4c0 .62.68.99 1.2.66l9.6-6.2a.78.78 0 0 0 0-1.32L9.2 5.14A.78.78 0 0 0 8 5.8z" /></svg>
                  </span>
                )}
              </button>
              <button className="ctrl-btn w-8 h-8" type="button" aria-label="次へ">
                <svg viewBox="0 0 24 24"><path d="M16 6h2v12h-2zM5.5 6.6v10.8c0 .5.56.8.98.52l8.1-5.4a.62.62 0 0 0 0-1.04l-8.1-5.4c-.42-.28-.98.02-.98.52z" /></svg>
              </button>
              <button className="ctrl-btn ym-sub-btn w-5 h-5" type="button" aria-label="リピート">
                <svg viewBox="0 0 24 24"><path d="M7 7h10v2.3l3.3-3.3L17 2.7V5H7a4 4 0 0 0-4 4v3h2V9a2 2 0 0 1 2-2zm10 10H7v-2.3L3.7 18 7 21.3V19h10a4 4 0 0 0 4-4v-3h-2v3a2 2 0 0 1-2 2z" /></svg>
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2.5 mt-4">
              <span className="ctrl-btn w-4 h-4 shrink-0 opacity-60">
                <svg viewBox="0 0 24 24"><path d="M13 4.6v14.8c0 .7-.83 1.07-1.35.6L7.2 16H4.5A1.5 1.5 0 0 1 3 14.5v-5A1.5 1.5 0 0 1 4.5 8h2.7l4.45-4c.52-.47 1.35-.1 1.35.6z" /></svg>
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
              <span className="ctrl-btn w-4 h-4 shrink-0 opacity-60">
                <svg viewBox="0 0 24 24"><path d="M10 4.6v14.8c0 .7-.83 1.07-1.35.6L4.2 16H1.5A1.5 1.5 0 0 1 0 14.5v-5A1.5 1.5 0 0 1 1.5 8h2.7l4.45-4c.52-.47 1.35-.1 1.35.6z" /><path d="M14.5 8.2a.9.9 0 0 1 1.27.1 5.6 5.6 0 0 1 0 7.4.9.9 0 0 1-1.36-1.18 3.8 3.8 0 0 0 0-5.04.9.9 0 0 1 .09-1.28z" /><path d="M17.8 5.3a.9.9 0 0 1 1.27.08 10 10 0 0 1 0 13.24.9.9 0 0 1-1.35-1.19 8.2 8.2 0 0 0 0-10.86.9.9 0 0 1 .08-1.27z" /></svg>
              </span>
            </div>

            {/* Bottom tabs */}
            <div className="ym-tabs">
              <span>次の曲</span>
              <span>歌詞</span>
              <span>関連</span>
            </div>

            {/* Copyright */}
            <div className="ym-copyright" id="copyright-text">{applied.copyright}</div>

          </div>
        </div>

        {/* ---- Right panel (controls) ---- */}
        <div className="glass-panel side-panel input-section absolute inset-y-0 right-0 flex flex-col w-[320px] p-6 overflow-y-auto max-md:static max-md:w-full max-md:max-w-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#ff0000]" />
              <h2 className="panel-title text-sm font-semibold tracking-wide uppercase">YouTube Music</h2>
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
            <button className="btn-primary btn-save" id="btn-capture" type="button" onClick={handleCapture}>画像として保存</button>
          </div>
        </div>

      </div>
    </div>
  );
}
