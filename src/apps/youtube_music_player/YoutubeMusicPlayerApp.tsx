import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type Ref } from 'react';
import { useCapture } from '../../shared/capture/useCapture';
import { VideoExportPanel } from '../../shared/video/VideoExportPanel';
import { useLocalAudio } from '../../shared/video/useLocalAudio';
import type { PlayerFrameState } from '../../shared/video/video-types';
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

interface YoutubeMusicPlayerCardProps {
  applied: AppliedCard;
  frameState: PlayerFrameState;
  cardRef?: Ref<HTMLDivElement>;
  interactive?: boolean;
  onPlayToggle?: () => void;
  onSeekPercent?: (percent: number) => void;
  onVolumeChange?: (volume: number) => void;
}

function YoutubeMusicPlayerCard({ applied, frameState, cardRef, interactive = false, onPlayToggle, onSeekPercent, onVolumeChange }: YoutubeMusicPlayerCardProps) {
  const progress = Math.min(Math.max(frameState.progress * 100, 0), 100);
  const volume = Math.min(Math.max(frameState.volume * 100, 0), 100);
  const cardStyle = { background: `linear-gradient(180deg, ${shadeColor(applied.bgColor, 9)} 0%, ${applied.bgColor} 55%)`, color: applied.textColor, '--player-point': applied.pointColor, '--player-text': applied.textColor } as CSSProperties;
  return <div className={`ym-card${interactive ? '' : ' video-export-frame'}`} id={interactive ? 'player-card' : undefined} ref={cardRef} style={cardStyle}>
    <div className="ym-topbar"><button className="ctrl-btn" type="button" aria-label="閉じる"><svg viewBox="0 0 24 24" fill="none"><path d="M5 9l7 7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button><span className="text-[11px] font-medium tracking-[0.12em] uppercase opacity-60">再生中</span><button className="ctrl-btn" type="button" aria-label="その他"><svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg></button></div>
    <div id={interactive ? 'cover-img' : undefined} className="ym-artwork" style={{ backgroundImage: `url('${applied.cover}')` }} />
    <div className="flex items-center gap-3 mb-4"><div className="flex-1 min-w-0"><div className="ym-title" id={interactive ? 'song-title' : undefined}>{applied.title}</div><div className="ym-artist" id={interactive ? 'song-artist' : undefined}>{applied.artist}</div></div><button className="ctrl-btn ym-sub-btn w-5 h-5 shrink-0" type="button" aria-label="低評価"><svg viewBox="0 0 24 24"><path d="M15 3H6.5A2.5 2.5 0 0 0 4 5.5l-1.4 7A2.5 2.5 0 0 0 5.05 15H10l-.7 4.2A1.8 1.8 0 0 0 11.08 21c.5 0 .96-.26 1.22-.68L16 14.5V3h-1z" /><path d="M18 3h3v11h-3z" /></svg></button><button className="ctrl-btn ym-sub-btn w-5 h-5 shrink-0" type="button" aria-label="高評価"><svg viewBox="0 0 24 24"><path d="M9 21h8.5a2.5 2.5 0 0 0 2.5-2.5l1.4-7A2.5 2.5 0 0 0 18.95 9H14l.7-4.2A1.8 1.8 0 0 0 12.92 3c-.5 0-.96.26-1.22.68L8 9.5V21h1z" /><path d="M3 10h3v11H3z" /></svg></button></div>
    <div className="slider-wrap" id={interactive ? 'progress-wrap' : undefined}><div className="slider-track" /><div className="slider-fill" id={interactive ? 'progress-fill' : undefined} style={{ width: `${progress}%` }} /><div className="slider-thumb" id={interactive ? 'progress-thumb' : undefined} style={{ left: `${progress}%` }} />{interactive && <input className="slider-input" type="range" id="progress-slider" value={progress} min="0" max="100" onChange={(event) => onSeekPercent?.(Number(event.target.value))} aria-label="再生位置" />}</div>
    <div className="ym-times"><span id={interactive ? 'time-current' : undefined}>{ymFormatTime(frameState.currentTime)}</span><span id={interactive ? 'time-total' : undefined}>{frameState.duration > 0 ? ymFormatTime(frameState.duration) : '-:--'}</span></div>
    <div className="flex items-center justify-between mt-3 px-1"><button className="ctrl-btn ym-sub-btn w-5 h-5" type="button" aria-label="シャッフル"><svg viewBox="0 0 24 24"><path d="M17 4l3.3 3.3-3.3 3.3v-2.3h-1.9c-.9 0-1.7.4-2.2 1.1l-1.2 1.6-1.5-2 1.1-1.5A4.75 4.75 0 0 1 15.1 6H17V4zM3 6h3.9c1.5 0 2.9.7 3.8 1.9l4.2 5.6c.5.7 1.3 1.1 2.2 1.1H19v-2.3l3.3 3.3L19 18.9v-2.3h-1.9c-1.5 0-2.9-.7-3.8-1.9L9.1 9.1C8.6 8.4 7.8 8 6.9 8H3V6zm6 8.6l1.5 2-.4.5c-.9 1.2-2.3 1.9-3.8 1.9H3v-2h3.3c.9 0 1.7-.4 2.2-1.1l.5-.7z" /></svg></button><button className="ctrl-btn w-8 h-8" type="button" aria-label="前へ"><svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zM18.5 6.6v10.8c0 .5-.56.8-.98.52l-8.1-5.4a.62.62 0 0 1 0-1.04l8.1-5.4c.42-.28.98.02.98.52z" /></svg></button><button className="ctrl-btn ym-play-btn" type="button" id={interactive ? 'btn-play' : undefined} aria-label="再生と一時停止" onClick={onPlayToggle}>{frameState.playing ? <span className="flex items-center justify-center h-full w-full" id={interactive ? 'icon-pause' : undefined}><svg viewBox="0 0 24 24"><rect x="6" y="4.5" width="4.4" height="15" rx="0.8" /><rect x="13.6" y="4.5" width="4.4" height="15" rx="0.8" /></svg></span> : <span className="flex items-center justify-center h-full w-full" id={interactive ? 'icon-play' : undefined}><svg viewBox="0 0 24 24"><path d="M8 5.8v12.4c0 .62.68.99 1.2.66l9.6-6.2a.78.78 0 0 0 0-1.32L9.2 5.14A.78.78 0 0 0 8 5.8z" /></svg></span>}</button><button className="ctrl-btn w-8 h-8" type="button" aria-label="次へ"><svg viewBox="0 0 24 24"><path d="M16 6h2v12h-2zM5.5 6.6v10.8c0 .5.56.8.98.52l8.1-5.4a.62.62 0 0 0 0-1.04l-8.1-5.4c-.42-.28-.98.02-.98.52z" /></svg></button><button className="ctrl-btn ym-sub-btn w-5 h-5" type="button" aria-label="リピート"><svg viewBox="0 0 24 24"><path d="M7 7h10v2.3l3.3-3.3L17 2.7V5H7a4 4 0 0 0-4 4v3h2V9a2 2 0 0 1 2-2zm10 10H7v-2.3L3.7 18 7 21.3V19h10a4 4 0 0 0 4-4v-3h-2v3a2 2 0 0 1-2 2z" /></svg></button></div>
    <div className="flex items-center gap-2.5 mt-4"><span className="ctrl-btn w-4 h-4 shrink-0 opacity-60"><svg viewBox="0 0 24 24"><path d="M13 4.6v14.8c0 .7-.83 1.07-1.35.6L7.2 16H4.5A1.5 1.5 0 0 1 3 14.5v-5A1.5 1.5 0 0 1 4.5 8h2.7l4.45-4c.52-.47 1.35-.1 1.35.6z" /></svg></span><div className="slider-wrap flex-1"><div className="slider-track" /><div className="slider-fill" id={interactive ? 'volume-fill' : undefined} style={{ width: `${volume}%` }} /><div className="slider-thumb" id={interactive ? 'volume-thumb' : undefined} style={{ left: `${volume}%` }} />{interactive && <input className="slider-input" type="range" id="volume-slider" value={volume} min="0" max="100" onChange={(event) => onVolumeChange?.(Number(event.target.value) / 100)} aria-label="音量" />}</div><span className="ctrl-btn w-4 h-4 shrink-0 opacity-60"><svg viewBox="0 0 24 24"><path d="M10 4.6v14.8c0 .7-.83 1.07-1.35.6L4.2 16H1.5A1.5 1.5 0 0 1 0 14.5v-5A1.5 1.5 0 0 1 1.5 8h2.7l4.45-4c.52-.47 1.35-.1 1.35.6z" /><path d="M14.5 8.2a.9.9 0 0 1 1.27.1 5.6 5.6 0 0 1 0 7.4.9.9 0 0 1-1.36-1.18 3.8 3.8 0 0 0 0-5.04.9.9 0 0 1 .09-1.28z" /><path d="M17.8 5.3a.9.9 0 0 1 1.27.08 10 10 0 0 1 0 13.24.9.9 0 0 1-1.35-1.19 8.2 8.2 0 0 0 0-10.86.9.9 0 0 1 .08-1.27z" /></svg></span></div>
    <div className="ym-tabs"><span>次の曲</span><span>歌詞</span><span>関連</span></div><div className="ym-copyright" id={interactive ? 'copyright-text' : undefined}>{applied.copyright}</div>
  </div>;
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
  const [frameState, setFrameState] = useState<PlayerFrameState>({ currentTime: 0, duration: 0, progress: 0, playing: false, volume: 0.5 });

  const cardRef = useRef<HTMLDivElement | null>(null);
  const exportCardRef = useRef<HTMLDivElement | null>(null);
  const { capture } = useCapture();
  const localAudio = useLocalAudio();
  const exportingRef = useRef(false);
  const exportWasPlayingRef = useRef(false);
  const [videoExporting, setVideoExporting] = useState(false);

  const yt = useYouTubePlayer({
    width: '1',
    height: '1',
    playerVars: { autoplay: 0, controls: 0, playsinline: 1 },
    onStateChange: state => {
      if (!window.YT) return;
      if (state === window.YT.PlayerState.ENDED) {
        setFrameState((current) => ({ ...current, currentTime: 0, duration: yt.getDuration(), progress: 0, playing: false }));
      } else if (!localAudio.file) {
        setFrameState((current) => ({ ...current, playing: state === window.YT.PlayerState.PLAYING }));
      }
    },
    onProgress: (currentTime, duration) => {
      if (duration > 0) {
        if (!localAudio.file) setFrameState((current) => ({ ...current, currentTime, duration, progress: currentTime / duration }));
      }
    },
  });

  useEffect(() => {
    if (!localAudio.file || exportingRef.current) return;
    setFrameState({ currentTime: localAudio.currentTime, duration: localAudio.duration, progress: localAudio.duration > 0 ? localAudio.currentTime / localAudio.duration : 0, playing: localAudio.playing, volume: localAudio.volume });
  }, [localAudio.currentTime, localAudio.duration, localAudio.file, localAudio.playing, localAudio.volume]);

  function applyPreview(nextColors = colors) {
    if (exportingRef.current) return;
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

    if (youtubeId && !localAudio.file) {
      yt.cueVideo(youtubeId);
      setFrameState((current) => ({ ...current, currentTime: 0, duration: 0, progress: 0, playing: false }));
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
    if (exportingRef.current) return;
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { uploadedImageRef.current = String(reader.result); };
    reader.readAsDataURL(file);
  }

  function handlePlayClick() {
    if (exportingRef.current) return;
    if (localAudio.file) {
      yt.stop();
      if (localAudio.playing) localAudio.pause(); else void localAudio.play();
      return;
    }
    if (!yt.ready) {
      alert('まず[適用してプレビュー]を押して音楽を設定してください！');
      return;
    }
    if (frameState.playing) yt.pause(); else yt.play();
  }

  function handleSeekPercent(percent: number) {
    if (exportingRef.current) return;
    const duration = localAudio.file ? localAudio.duration : yt.getDuration();
    const currentTime = duration > 0 ? duration * percent / 100 : 0;
    if (localAudio.file) localAudio.seek(currentTime); else yt.seekTo(currentTime);
    setFrameState((current) => ({ ...current, currentTime, duration, progress: duration > 0 ? currentTime / duration : 0 }));
  }

  function handleVolumeChange(volume: number) {
    if (exportingRef.current) return;
    const safeVolume = Math.min(Math.max(volume, 0), 1);
    if (localAudio.file) localAudio.setVolume(safeVolume); else yt.setVolume(safeVolume * 100);
    setFrameState((current) => ({ ...current, volume: safeVolume }));
  }

  function handleAudioFileChange(file: File | null) {
    if (exportingRef.current) return;
    if (!file) { localAudio.clear(); return; }
    yt.stop();
    localAudio.pause();
    void localAudio.selectFile(file);
    localAudio.setVolume(frameState.volume);
  }

  async function handleCapture(): Promise<void> {
    try {
      await capture(cardRef.current!, 'youtube_music_player.png');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      alert('画像の生成に失敗しました: ' + message);
    }
  }

  function handleVideoFrame(nextFrame: PlayerFrameState): Promise<void> {
    return new Promise((resolve) => { setFrameState(nextFrame); requestAnimationFrame(() => resolve()); });
  }

  function handleExportStart() {
    exportingRef.current = true;
    exportWasPlayingRef.current = localAudio.playing;
    setVideoExporting(true);
    if (localAudio.playing) localAudio.pause();
    setFrameState((current) => ({ ...current, playing: false }));
  }

  function handleExportEnd() {
    const shouldResume = exportWasPlayingRef.current;
    exportingRef.current = false;
    setVideoExporting(false);
    setFrameState((current) => ({
      ...current,
      currentTime: localAudio.currentTime,
      duration: localAudio.duration,
      progress: localAudio.duration > 0 ? localAudio.currentTime / localAudio.duration : 0,
      playing: shouldResume,
      volume: localAudio.volume,
    }));
    if (shouldResume) void localAudio.play();
  }

  return (
    <div className="app-ytmusic">
      <div
        id="youtube-audio"
        className="pointer-events-none fixed -left-0.5 -top-0.5 h-px w-px overflow-hidden"
        ref={yt.containerRef}
      />

      <div className="maker-layout relative flex min-h-screen w-full max-w-[1500px] mx-auto items-center justify-center pr-[340px] max-md:flex-col max-md:px-4 max-md:py-6 max-md:gap-4 max-md:min-h-0 max-md:justify-start">

        <div id="capture-area" className={`flex w-full justify-center max-md:w-auto${videoExporting ? ' video-export-lock' : ''}`}><YoutubeMusicPlayerCard applied={applied} frameState={frameState} cardRef={cardRef} interactive onPlayToggle={handlePlayClick} onSeekPercent={handleSeekPercent} onVolumeChange={handleVolumeChange} /></div>
        <div className="video-export-card" aria-hidden="true"><YoutubeMusicPlayerCard applied={applied} frameState={frameState} cardRef={exportCardRef} /></div>

        {/* ---- Right panel (controls) ---- */}
        <div className="glass-panel side-panel input-section absolute inset-y-0 right-0 flex flex-col w-[320px] p-6 overflow-y-auto max-md:static max-md:w-full max-md:max-w-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#ff0000]" />
              <h2 className="panel-title text-sm font-semibold tracking-wide uppercase">YouTube Music</h2>
            </div>
            <ThemeToggle className="theme-toggle" disabled={videoExporting} />
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="field-label" htmlFor="in-title">Title</label>
              <input className="field-input" type="text" id="in-title" placeholder="タイトルまたはキャッチフレーズ" value={title} disabled={videoExporting} onChange={e => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="in-artist">Artist</label>
              <input className="field-input" type="text" id="in-artist" placeholder="アーティスト名" value={artist} disabled={videoExporting} onChange={e => setArtist(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="in-image">Cover Image</label>
              <input className="file-input" type="file" id="in-image" accept="image/*" disabled={videoExporting} onChange={handleImageChange} />
            </div>
            <div>
              <label className="field-label" htmlFor="in-youtube">YouTube URL</label>
              <input className="field-input" type="text" id="in-youtube" placeholder="例: https://www.youtube.com/watch?v=w2-uvGZCe3g" value={youtube} disabled={videoExporting} onChange={e => setYoutube(e.target.value)} />
              <p className="help-text text-[11px] mt-1.5">動画の URL を貼り付けてください</p>
            </div>
            <div>
              <label className="field-label" htmlFor="in-copyright">Copyright</label>
              <input className="field-input" type="text" id="in-copyright" placeholder="ⓒ 依頼主" value={copyright} disabled={videoExporting} onChange={e => setCopyright(e.target.value)} />
            </div>
          </div>

          <hr className="divider" />

          {/* Color pickers */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="field-label" htmlFor="in-bg-color">BG</label>
              <div className="color-picker-wrap">
                <input type="color" id="in-bg-color" value={colors.bgColor} disabled={videoExporting} onChange={e => setColors({ ...colors, bgColor: e.target.value })} />
              </div>
            </div>
            <div className="flex-1">
              <label className="field-label" htmlFor="in-point-color">Accent</label>
              <div className="color-picker-wrap">
                <input type="color" id="in-point-color" value={colors.pointColor} disabled={videoExporting} onChange={e => setColors({ ...colors, pointColor: e.target.value })} />
              </div>
            </div>
            <div className="flex-1">
              <label className="field-label" htmlFor="in-text-color">Text</label>
              <div className="color-picker-wrap">
                <input type="color" id="in-text-color" value={colors.textColor} disabled={videoExporting} onChange={e => setColors({ ...colors, textColor: e.target.value })} />
              </div>
            </div>
          </div>

          <hr className="divider" />

          <div className="flex flex-col gap-2.5">
            <button className="btn-primary btn-apply" id="btn-update" type="button" disabled={videoExporting} onClick={() => applyPreview()}>適用してプレビュー</button>
          </div>
          <VideoExportPanel appId="youtube-music-player" exportCardRef={exportCardRef} audio={localAudio} onAudioFileChange={handleAudioFileChange} frameState={frameState} duration={frameState.duration} currentTime={frameState.currentTime} onSeek={(seconds) => handleSeekPercent(frameState.duration > 0 ? seconds / frameState.duration * 100 : 0)} onFrame={handleVideoFrame} volume={frameState.volume} onVolumeChange={handleVolumeChange} onImageSave={handleCapture} onExportStart={handleExportStart} onExportEnd={handleExportEnd} onPreviewStart={(range) => { if (exportingRef.current) return; localAudio.seek(range.start); void localAudio.play(); }} onPreviewStop={() => { if (!exportingRef.current) localAudio.pause(); }} />
        </div>

      </div>
    </div>
  );
}
