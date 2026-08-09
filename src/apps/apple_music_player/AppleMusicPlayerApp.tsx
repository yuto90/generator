import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { useCapture } from '../../shared/capture/useCapture';
import { DeviceCanvas, DevicePreviewProvider, DeviceToolbar, useDevicePreview } from '../../shared/device-preview';
import ImageCropField from '../../shared/image-crop/ImageCropField';
import { createEditableImage, getEditableImageStyle, type EditableImage } from '../../shared/image-crop/image-crop';
import { ThemeToggle } from '../../shared/theme/ThemeToggle';
import { useTheme } from '../../shared/theme/ThemeContext';
import { useYouTubePlayer } from '../../shared/youtube/useYouTubePlayer';
import { extractYouTubeId } from '../../shared/youtube/youtube';
import './apple-music-player.css';

// 外部プレースホルダーサービスに依存しないよう、デフォルトカバーはインライン SVG
const DEFAULT_COVER = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="340" height="340" viewBox="0 0 340 340">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#a44b63"/>
      <stop offset="1" stop-color="#5d2434"/>
    </linearGradient>
  </defs>
  <rect width="340" height="340" fill="url(#g)"/>
  <g fill="rgba(255,255,255,0.55)" transform="translate(170 170) scale(4.6) translate(-12 -12)">
    <path d="M9 18V5l12-2v13"/>
    <path d="M9 18V5l12-2v13" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="6" cy="18" r="3"/>
    <circle cx="18" cy="16" r="3"/>
  </g>
</svg>`);

const THEME_COLORS = {
  dark: { bgColor: '#8e3b52', pointColor: '#ffffff', textColor: '#ffffff' },
  light: { bgColor: '#f2b6c4', pointColor: '#a91636', textColor: '#32151d' },
};

// Apple Music の Now Playing はアートワーク由来のグラデーション背景。
// ここでは BG カラーを基準に明暗 2 段のグラデーションを生成して近づける。
function shadeColor(hex: string, percent: number): string {
  const n = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, (n >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt));
  const b = Math.min(255, Math.max(0, (n & 0xff) + amt));
  return `rgb(${r}, ${g}, ${b})`;
}

function amFormatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '-:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface AppliedCard {
  title: string;
  artist: string;
  copyright: string;
  cover: EditableImage;
  bgColor: string;
  pointColor: string;
  textColor: string;
}

function AppleMusicPlayerContent() {
  const { theme } = useTheme();
  const { outputSize, captureSize, valid } = useDevicePreview();

  // ---- フォーム入力 ----
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [copyright, setCopyright] = useState('');
  const [youtube, setYoutube] = useState('');
  const [colors, setColors] = useState(THEME_COLORS.dark);
  const [coverImage, setCoverImage] = useState(() => createEditableImage(DEFAULT_COVER));

  // ---- 適用済みプレビュー ----
  const [applied, setApplied] = useState<AppliedCard>({
    title: '曲のタイトル',
    artist: 'アーティスト名',
    copyright: 'ⓒ 出典',
    cover: createEditableImage(DEFAULT_COVER),
    ...THEME_COLORS.dark,
  });
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [times, setTimes] = useState({ current: 0, duration: 0 });
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
      cover: coverImage,
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
    if (!valid) return;
    capture(cardRef.current, 'apple_music_player.png', outputSize, captureSize).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      alert(message);
    });
  }

  const cardStyle = {
    background: `linear-gradient(165deg, ${shadeColor(applied.bgColor, 16)} 0%, ${applied.bgColor} 45%, ${shadeColor(applied.bgColor, -28)} 100%)`,
    color: applied.textColor,
    '--player-point': applied.pointColor,
    '--player-text': applied.textColor,
    '--device-preview-width': `${outputSize.width}px`,
    '--device-preview-height': `${outputSize.height}px`,
    containerType: 'size',
  } as CSSProperties;

  return (
    <div className="app-apple">
      <div
        id="youtube-audio"
        className="pointer-events-none fixed -left-0.5 -top-0.5 h-px w-px overflow-hidden"
        ref={yt.containerRef}
      />

      <div className="maker-layout relative flex min-h-screen w-full max-w-[1500px] mx-auto items-center justify-center pr-[340px] max-md:flex-col max-md:px-4 max-md:py-6 max-md:gap-4 max-md:min-h-0 max-md:justify-start" data-device-preview-stage>

        {/* ---- Center: Apple Music player preview ---- */}
        <div id="capture-area" className="device-preview-slot flex w-full justify-center max-md:w-auto" data-device-preview-slot>
          <div className="device-preview-stack">
            <DeviceToolbar />
            <DeviceCanvas>
              <div className="am-card" id="player-card" ref={cardRef} style={cardStyle}>

            <div
              id="cover-img"
              className={playing ? 'am-artwork-stage playing' : 'am-artwork-stage'}
              style={getEditableImageStyle(applied.cover)}
            />
            <div className="am-artwork-shade" aria-hidden="true" />
            <div className="am-screen-content">
            <div className="am-grabber" aria-hidden="true" />
            <section className="am-player-panel" aria-label="再生中の曲">

            {/* Song info */}
            <div className="am-track-row">
              <div className="am-track-copy">
                <div className="am-title" id="song-title">{applied.title}</div>
                <div className="am-artist" id="song-artist">{applied.artist}</div>
              </div>
              <div className="am-track-actions">
                <button className="am-icon-button am-favorite-button" type="button" aria-label="お気に入り" data-glyph="star">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3z" /></svg>
                </button>
                <button className="am-icon-button" type="button" aria-label="その他">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" /></svg>
                </button>
              </div>
            </div>

            {/* Progress slider */}
            <div className="slider-wrap" id="progress-wrap">
              <div className="slider-track" />
              <div className="slider-fill" id="progress-fill" style={{ width: `${progress}%` }} />
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
            <div className="am-times">
              <span id="time-current">{amFormatTime(times.current)}</span>
              <span className="am-format-badge">Dolby Atmos</span>
              <span id="time-remaining">
                {times.duration > 0 ? `-${amFormatTime(times.duration - times.current)}` : '-:--'}
              </span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-12 mt-4 mb-4">
              <button className="ctrl-btn w-8 h-8" type="button" aria-label="前へ">
                <svg viewBox="0 0 24 24"><path d="M11.6 6.1v11.8c0 .55-.62.86-1.06.53L2.6 12.53a.66.66 0 0 1 0-1.06l7.94-5.9c.44-.33 1.06-.02 1.06.53z" /><path d="M21.6 6.1v11.8c0 .55-.62.86-1.06.53l-7.94-5.9a.66.66 0 0 1 0-1.06l7.94-5.9c.44-.33 1.06-.02 1.06.53z" /></svg>
              </button>
              <button className="ctrl-btn w-11 h-11" type="button" id="btn-play" aria-label="再生と一時停止" onClick={handlePlayClick}>
                {playing ? (
                  <span className="block h-full w-full" id="icon-pause">
                    <svg viewBox="0 0 24 24"><rect x="6" y="4.5" width="4.4" height="15" rx="1.3" /><rect x="13.6" y="4.5" width="4.4" height="15" rx="1.3" /></svg>
                  </span>
                ) : (
                  <span className="block h-full w-full" id="icon-play">
                    <svg viewBox="0 0 24 24"><path d="M7.5 5.6v12.8c0 .62.68.99 1.2.66l10.1-6.4a.78.78 0 0 0 0-1.32L8.7 4.94a.78.78 0 0 0-1.2.66z" /></svg>
                  </span>
                )}
              </button>
              <button className="ctrl-btn w-8 h-8" type="button" aria-label="次へ">
                <svg viewBox="0 0 24 24"><path d="M2.4 6.1v11.8c0 .55.62.86 1.06.53l7.94-5.9a.66.66 0 0 0 0-1.06L3.46 5.57c-.44-.33-1.06-.02-1.06.53z" /><path d="M12.4 6.1v11.8c0 .55.62.86 1.06.53l7.94-5.9a.66.66 0 0 0 0-1.06l-7.94-5.9c-.44-.33-1.06-.02-1.06.53z" /></svg>
              </button>
            </div>

            {/* Bottom icons (lyrics / AirPlay / queue) */}
            <div className="am-bottom-icons">
              <button className="ctrl-btn" type="button" aria-label="歌詞">
                <svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.9 2 11.7c0 2.7 1.4 5.1 3.7 6.7-.2 1-.7 2-1.5 2.8-.3.3 0 .8.4.8 1.9-.2 3.5-1 4.6-1.9.9.2 1.9.4 2.8.4 5.5 0 10-3.9 10-8.8S17.5 3 12 3zm-4.5 9.9a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm4.5 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm4.5 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6z" /></svg>
              </button>
              <button className="ctrl-btn" type="button" aria-label="Chromecast">
                <svg viewBox="0 0 24 24"><path d="M4.5 4h15A2.5 2.5 0 0 1 22 6.5v8a2.5 2.5 0 0 1-2.5 2.5h-2.2l-1.7-2h3.9a.5.5 0 0 0 .5-.5v-8a.5.5 0 0 0-.5-.5h-15a.5.5 0 0 0-.5.5v2h-2v-2A2.5 2.5 0 0 1 4.5 4z" /><path d="M2 15.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm0 3.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm0-7a1 1 0 1 0 0 2 1 1 0 0 0-1 0zM6.5 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" /></svg>
              </button>
              <button className="ctrl-btn" type="button" aria-label="次に再生">
                <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="2.2" rx="1.1" /><rect x="3" y="11" width="11" height="2.2" rx="1.1" /><rect x="3" y="17" width="11" height="2.2" rx="1.1" /><path d="M17.5 12.3v7.1c0 .5.55.8.97.53l3.1-2c.4-.26.4-.86 0-1.12l-3.1-2c-.42-.27-.97.02-.97.5z" transform="translate(0 -3.2)" /></svg>
              </button>
            </div>

            {/* Copyright */}
            <div className="am-copyright" id="copyright-text">{applied.copyright}</div>

            </section>
            </div>

              </div>
            </DeviceCanvas>
          </div>
        </div>

        {/* ---- Right panel (controls) ---- */}
        <div className="glass-panel side-panel input-section absolute inset-y-0 right-0 flex flex-col w-[320px] p-6 overflow-y-auto max-md:static max-md:w-full max-md:max-w-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#fa2d48]" />
              <h2 className="panel-title text-sm font-semibold tracking-wide uppercase">Apple Music</h2>
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
            <ImageCropField
              id="in-image"
              label="Cover Image"
              value={coverImage}
              targetAspect={1}
              onChange={setCoverImage}
            />
            <div>
              <label className="field-label" htmlFor="in-youtube">YouTube URL</label>
              <input className="field-input" type="text" id="in-youtube" placeholder="例: https://www.youtube.com/watch?v=w2-uvGZCe3g" value={youtube} onChange={e => setYoutube(e.target.value)} />
              <p className="help-text text-[11px] mt-1.5">動画の URL を貼り付けてください</p>
            </div>
            <div>
              <label className="field-label" htmlFor="in-volume">音量</label>
              <input
                className="editor-range"
                id="in-volume"
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={handleVolumeInput}
                aria-label="音量"
              />
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
            <button className="btn-primary btn-save" id="btn-capture" type="button" onClick={handleCapture} disabled={capturing || !valid}>
              {capturing ? '画像を生成中…' : '画像として保存'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function AppleMusicPlayerApp() {
  return <DevicePreviewProvider><AppleMusicPlayerContent /></DevicePreviewProvider>;
}
