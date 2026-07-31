import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type Ref } from 'react';
import { useCapture } from '../../shared/capture/useCapture';
import { VideoExportPanel } from '../../shared/video/VideoExportPanel';
import { useLocalAudio } from '../../shared/video/useLocalAudio';
import type { PlayerFrameState } from '../../shared/video/video-types';
import { ThemeToggle } from '../../shared/theme/ThemeToggle';
import { useTheme } from '../../shared/theme/ThemeContext';
import { useYouTubePlayer } from '../../shared/youtube/useYouTubePlayer';
import { extractYouTubeId } from '../../shared/youtube/youtube';
import { NextIcon, PauseIcon, PlayIcon, PreviousIcon, VolumeHighIcon } from './icons';
import './music-player.css';

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

interface MusicPlayerCardProps {
  applied: AppliedCard;
  frameState: PlayerFrameState;
  cardRef?: Ref<HTMLDivElement>;
  interactive?: boolean;
  onPlayToggle?: () => void;
  onSeekPercent?: (percent: number) => void;
  onVolumeChange?: (volume: number) => void;
}

function formatTime(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

function MusicPlayerCard({
  applied,
  frameState,
  cardRef,
  interactive = false,
  onPlayToggle,
  onSeekPercent,
  onVolumeChange,
}: MusicPlayerCardProps) {
  const progress = Math.min(Math.max(frameState.progress * 100, 0), 100);
  const volume = Math.min(Math.max(frameState.volume * 100, 0), 100);
  const cardStyle = {
    '--player-bg': applied.bgColor,
    '--player-point': applied.pointColor,
    '--player-text': applied.textColor,
  } as CSSProperties;

  return (
    <div className={`player-card${interactive ? '' : ' video-export-frame'}`} id={interactive ? 'player-card' : undefined} ref={cardRef} style={cardStyle}>
      <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-2xl" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
        <div
          id={interactive ? 'cover-img' : undefined}
          className="absolute inset-0 h-full w-full bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url('${applied.cover}')` }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-12" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)' }} />
      </div>

      <div className="mb-3 text-right text-[10px] opacity-40" id={interactive ? 'copyright-text' : undefined} style={{ color: 'var(--player-text)' }}>
        {applied.copyright}
      </div>

      <div className="mb-4" style={{ color: 'var(--player-text)' }}>
        <div className="text-base font-bold mb-0.5 leading-tight" id={interactive ? 'song-title' : undefined}>{applied.title}</div>
        <div className="text-[12px] opacity-50" id={interactive ? 'song-artist' : undefined}>{applied.artist}</div>
      </div>

      <div className="slider-wrap mb-1" id={interactive ? 'progress-wrap' : undefined}>
        <div className="slider-track" />
        <div className="slider-fill" id={interactive ? 'progress-fill' : undefined} style={{ width: `${progress}%` }} />
        <div className="slider-thumb" id={interactive ? 'progress-thumb' : undefined} style={{ left: `${progress}%` }} />
        {interactive && (
          <input
            className="slider-input"
            type="range"
            id="progress-slider"
            value={progress}
            min="0"
            max="100"
            onChange={(event) => onSeekPercent?.(Number(event.target.value))}
            aria-label="再生位置"
          />
        )}
      </div>
      <div className="flex justify-between text-[10px] opacity-30 mb-4" style={{ color: 'var(--player-text)' }}>
        <span>{formatTime(frameState.currentTime)}</span><span>{frameState.duration > 0 ? formatTime(frameState.duration) : '—'}</span>
      </div>

      <div className="flex items-center justify-center gap-7 mb-4">
        <span className="ctrl-btn w-6 h-6"><PreviousIcon className="block h-full w-full" /></span>
        {interactive ? (
          <button className="ctrl-btn ctrl-btn-play" type="button" id="btn-play" aria-label="再生と一時停止" onClick={onPlayToggle}>
            {frameState.playing ? <span className="flex h-5 w-5" id="icon-pause"><PauseIcon className="block h-full w-full" /></span> : <span className="flex h-5 w-5 ml-0.5" id="icon-play"><PlayIcon className="block h-full w-full" /></span>}
          </button>
        ) : (
          <span className="ctrl-btn ctrl-btn-play">{frameState.playing ? <PauseIcon className="block h-5 w-5" /> : <PlayIcon className="block h-5 w-5 ml-0.5" />}</span>
        )}
        <span className="ctrl-btn w-6 h-6"><NextIcon className="block h-full w-full" /></span>
      </div>

      <div className="flex items-center gap-2.5">
        <span className="ctrl-btn w-4 h-4 shrink-0">
          <svg viewBox="0 0 24 24" className="block h-full w-full fill-current" aria-hidden="true"><path d="M13 4.6v14.8c0 .7-.83 1.07-1.35.6L7.2 16H4.5A1.5 1.5 0 0 1 3 14.5v-5A1.5 1.5 0 0 1 4.5 8h2.7l4.45-4c.52-.47 1.35-.1 1.35.6z" /></svg>
        </span>
        <div className="slider-wrap flex-1">
          <div className="slider-track" />
          <div className="slider-fill" id={interactive ? 'volume-fill' : undefined} style={{ width: `${volume}%` }} />
          <div className="slider-thumb" id={interactive ? 'volume-thumb' : undefined} style={{ left: `${volume}%` }} />
          {interactive && (
            <input
              className="slider-input"
              type="range"
              id="volume-slider"
              value={volume}
              min="0"
              max="100"
              onChange={(event) => onVolumeChange?.(Number(event.target.value) / 100)}
              aria-label="音量"
            />
          )}
        </div>
        <span className="ctrl-btn w-4 h-4 shrink-0"><VolumeHighIcon className="block h-full w-full" /></span>
      </div>
    </div>
  );
}

export default function MusicPlayerApp() {
  const { theme } = useTheme();
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [copyright, setCopyright] = useState('');
  const [youtube, setYoutube] = useState('');
  const [colors, setColors] = useState(THEME_COLORS.dark);
  const uploadedImageRef = useRef<string | null>(null);
  const [applied, setApplied] = useState<AppliedCard>({
    title: '曲のタイトル',
    artist: 'アーティスト名',
    copyright: 'ⓒ 出典',
    cover: DEFAULT_COVER,
    ...THEME_COLORS.dark,
  });
  const [frameState, setFrameState] = useState<PlayerFrameState>({
    currentTime: 0,
    duration: 0,
    progress: 0,
    playing: false,
    volume: 0.5,
  });

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
    onStateChange: (state) => {
      if (!window.YT) return;
      if (state === window.YT.PlayerState.ENDED) {
        setFrameState((current) => ({ ...current, currentTime: 0, progress: 0, playing: false }));
      } else if (!localAudio.file) {
        setFrameState((current) => ({ ...current, playing: state === window.YT.PlayerState.PLAYING }));
      }
    },
    onProgress: (currentTime, duration) => {
      if (!localAudio.file && duration > 0) {
        setFrameState((current) => ({ ...current, currentTime, duration, progress: currentTime / duration }));
      }
    },
  });

  useEffect(() => {
    if (!localAudio.file || exportingRef.current) return;
    setFrameState({
      currentTime: localAudio.currentTime,
      duration: localAudio.duration,
      progress: localAudio.duration > 0 ? localAudio.currentTime / localAudio.duration : 0,
      playing: localAudio.playing,
      volume: localAudio.volume,
    });
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
      setFrameState((current) => ({ ...current, playing: false }));
    }
  }

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

  function handlePlayToggle() {
    if (exportingRef.current) return;
    if (localAudio.file) {
      yt.stop();
      if (localAudio.playing) localAudio.pause();
      else void localAudio.play();
      return;
    }
    if (!yt.ready) {
      alert('まず[適用してプレビュー]を押して音楽を設定してください！');
      return;
    }
    if (frameState.playing) yt.pause();
    else yt.play();
  }

  function handleSeek(seconds: number) {
    if (exportingRef.current) return;
    const duration = localAudio.file ? localAudio.duration : yt.getDuration();
    const safeSeconds = Math.min(Math.max(seconds, 0), duration || Number.POSITIVE_INFINITY);
    if (localAudio.file) localAudio.seek(safeSeconds);
    else yt.seekTo(safeSeconds);
    setFrameState((current) => ({ ...current, currentTime: safeSeconds, duration, progress: duration > 0 ? safeSeconds / duration : 0 }));
  }

  function handleSeekPercent(percent: number) {
    const duration = localAudio.file ? localAudio.duration : yt.getDuration();
    handleSeek(duration > 0 ? duration * percent / 100 : 0);
  }

  function handleVolumeChange(volume: number) {
    if (exportingRef.current) return;
    const safeVolume = Math.min(Math.max(volume, 0), 1);
    if (localAudio.file) localAudio.setVolume(safeVolume);
    else yt.setVolume(safeVolume * 100);
    setFrameState((current) => ({ ...current, volume: safeVolume }));
  }

  function handleAudioFileChange(file: File | null) {
    if (exportingRef.current) return;
    if (!file) {
      localAudio.clear();
      return;
    }
    yt.stop();
    localAudio.pause();
    void localAudio.selectFile(file);
    localAudio.setVolume(frameState.volume);
  }

  async function handleCapture(): Promise<void> {
    try {
      await capture(cardRef.current!, 'my_custom_player.png');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      alert('画像の生成に失敗しました: ' + message);
    }
  }

  function handleVideoFrame(nextFrame: PlayerFrameState): Promise<void> {
    return new Promise((resolve) => {
      setFrameState(nextFrame);
      requestAnimationFrame(() => resolve());
    });
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
    <div className="app-music">
      <div id="youtube-audio" className="pointer-events-none fixed -left-0.5 -top-0.5 h-px w-px overflow-hidden" ref={yt.containerRef} />

      <div className="maker-layout relative flex min-h-screen w-full max-w-[1500px] mx-auto items-center justify-center pr-[340px] max-md:flex-col max-md:px-4 max-md:py-6 max-md:gap-4 max-md:min-h-0 max-md:justify-start">
        <div id="capture-area" className={`flex w-full justify-center max-md:w-auto${videoExporting ? ' video-export-lock' : ''}`}>
          <MusicPlayerCard
            applied={applied}
            frameState={frameState}
            cardRef={cardRef}
            interactive
            onPlayToggle={handlePlayToggle}
            onSeekPercent={handleSeekPercent}
            onVolumeChange={handleVolumeChange}
          />
        </div>
        <div className="video-export-card" aria-hidden="true">
          <MusicPlayerCard applied={applied} frameState={frameState} cardRef={exportCardRef} />
        </div>

        <div className="glass-panel side-panel input-section absolute inset-y-0 right-0 flex flex-col w-[320px] p-6 overflow-y-auto max-md:static max-md:w-full max-md:max-w-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#7c6af0]" />
              <h2 className="panel-title text-sm font-semibold tracking-wide uppercase">Music Player</h2>
            </div>
            <ThemeToggle className="theme-toggle" disabled={videoExporting} />
          </div>

          <div className="flex flex-col gap-4">
            <div><label className="field-label" htmlFor="in-title">Title</label><input className="field-input" type="text" id="in-title" placeholder="タイトルまたはキャッチフレーズ" value={title} disabled={videoExporting} onChange={(event) => setTitle(event.target.value)} /></div>
            <div><label className="field-label" htmlFor="in-artist">Artist</label><input className="field-input" type="text" id="in-artist" placeholder="アーティスト名" value={artist} disabled={videoExporting} onChange={(event) => setArtist(event.target.value)} /></div>
            <div><label className="field-label" htmlFor="in-image">Cover Image</label><input className="file-input" type="file" id="in-image" accept="image/*" disabled={videoExporting} onChange={handleImageChange} /></div>
            <div>
              <label className="field-label" htmlFor="in-youtube">YouTube URL</label>
              <input className="field-input" type="text" id="in-youtube" placeholder="例: https://www.youtube.com/watch?v=w2-uvGZCe3g" value={youtube} disabled={videoExporting} onChange={(event) => setYoutube(event.target.value)} />
              <p className="help-text text-[11px] mt-1.5">動画の URL を貼り付けてください</p>
            </div>
            <div><label className="field-label" htmlFor="in-copyright">Copyright</label><input className="field-input" type="text" id="in-copyright" placeholder="ⓒ 依頼主" value={copyright} disabled={videoExporting} onChange={(event) => setCopyright(event.target.value)} /></div>
          </div>

          <hr className="divider" />

          <div className="flex gap-3">
            <div className="flex-1"><label className="field-label" htmlFor="in-bg-color">BG</label><div className="color-picker-wrap"><input type="color" id="in-bg-color" value={colors.bgColor} disabled={videoExporting} onChange={(event) => setColors({ ...colors, bgColor: event.target.value })} /></div></div>
            <div className="flex-1"><label className="field-label" htmlFor="in-point-color">Accent</label><div className="color-picker-wrap"><input type="color" id="in-point-color" value={colors.pointColor} disabled={videoExporting} onChange={(event) => setColors({ ...colors, pointColor: event.target.value })} /></div></div>
            <div className="flex-1"><label className="field-label" htmlFor="in-text-color">Text</label><div className="color-picker-wrap"><input type="color" id="in-text-color" value={colors.textColor} disabled={videoExporting} onChange={(event) => setColors({ ...colors, textColor: event.target.value })} /></div></div>
          </div>

          <hr className="divider" />

          <div className="flex flex-col gap-2.5">
            <button className="btn-primary btn-apply" id="btn-update" type="button" disabled={videoExporting} onClick={() => applyPreview()}>適用してプレビュー</button>
          </div>
          <VideoExportPanel
            appId="music-player"
            exportCardRef={exportCardRef}
            audio={localAudio}
            onAudioFileChange={handleAudioFileChange}
            frameState={frameState}
            duration={frameState.duration}
            currentTime={frameState.currentTime}
            onSeek={handleSeek}
            onFrame={handleVideoFrame}
            volume={frameState.volume}
            onVolumeChange={handleVolumeChange}
            onImageSave={handleCapture}
            onExportStart={handleExportStart}
            onExportEnd={handleExportEnd}
            onPreviewStart={(range) => {
              if (exportingRef.current) return;
              handleSeek(range.start);
              void localAudio.play();
            }}
            onPreviewStop={() => {
              if (!exportingRef.current) localAudio.pause();
            }}
          />
        </div>
      </div>
    </div>
  );
}
