import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type Ref } from 'react';
import { useCapture } from '../../shared/capture/useCapture';
import { calculateProgress, formatTime, parseTime } from '../../shared/player/player-utils';
import { ThemeToggle } from '../../shared/theme/ThemeToggle';
import { VideoExportPanel } from '../../shared/video/VideoExportPanel';
import { useLocalAudio } from '../../shared/video/useLocalAudio';
import type { PlayerFrameState } from '../../shared/video/video-types';
import { useYouTubePlayer } from '../../shared/youtube/useYouTubePlayer';
import { extractYouTubeId } from '../../shared/youtube/youtube';
import './spotify-player.css';

const DEFAULT_COVER = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1DB954"/>
      <stop offset="0.55" stop-color="#116b35"/>
      <stop offset="1" stop-color="#07150c"/>
    </linearGradient>
    <radialGradient id="glow" cx="25%" cy="18%" r="72%">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".32"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="640" height="640" fill="url(#bg)"/>
  <rect width="640" height="640" fill="url(#glow)"/>
  <circle cx="320" cy="320" r="138" fill="#08120b" fill-opacity=".78"/>
  <path d="M236 281c59-17 130-12 176 13" fill="none" stroke="#1DB954" stroke-width="25" stroke-linecap="round"/>
  <path d="M247 334c47-13 107-9 145 11" fill="none" stroke="#1DB954" stroke-width="21" stroke-linecap="round"/>
  <path d="M258 383c38-10 83-7 116 9" fill="none" stroke="#1DB954" stroke-width="17" stroke-linecap="round"/>
</svg>`);

interface FormErrors {
  image: string;
  current: string;
  duration: string;
  youtube: string;
}

const NO_ERRORS: FormErrors = { image: '', current: '', duration: '', youtube: '' };

interface Status {
  text: string;
  tone: '' | 'success' | 'error';
}

interface AppliedCard {
  title: string;
  artist: string;
  cover: string;
}

interface SpotifyPlayerCardProps {
  applied: AppliedCard;
  frameState: PlayerFrameState;
  cardRef?: Ref<HTMLElement>;
  interactive?: boolean;
  onPlayToggle?: () => void;
  onSeekPercent?: (percent: number) => void;
  onVolumeChange?: (volume: number) => void;
}

function SpotifyPlayerCard({
  applied,
  frameState,
  cardRef,
  interactive = false,
  onPlayToggle,
  onSeekPercent,
  onVolumeChange,
}: SpotifyPlayerCardProps) {
  const progress = calculateProgress(frameState.currentTime, frameState.duration);
  const volume = Math.min(Math.max(frameState.volume * 100, 0), 100);

  return (
    <article className={`spotify-card${interactive ? '' : ' video-export-frame'}`} id={interactive ? 'player-card' : undefined} ref={cardRef}>
      <div className="card-topbar">
        <button className="icon-button" type="button" aria-label="閉じる"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.3 8.7a1 1 0 0 1 1.4 0l5.3 5.3 5.3-5.3a1 1 0 1 1 1.4 1.4l-6 6a1 1 0 0 1-1.4 0l-6-6a1 1 0 0 1 0-1.4z" /></svg></button>
        <span className="playing-label">Now playing</span>
        <button className="icon-button" type="button" aria-label="その他"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg></button>
      </div>
      <div className="artwork" id={interactive ? 'cover-img' : undefined} role="img" aria-label="アートワーク" style={{ backgroundImage: `url("${applied.cover}")` }} />
      <div className="track-row">
        <div className="track-copy"><div className="track-title" id={interactive ? 'song-title' : undefined}>{applied.title}</div><div className="track-artist" id={interactive ? 'song-artist' : undefined}>{applied.artist}</div></div>
        <button className="icon-button heart-button" type="button" aria-label="お気に入り"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21a1 1 0 0 1-.55-.17C5.8 17.05 3 14.02 3 10.1A5.1 5.1 0 0 1 12 6.8a5.1 5.1 0 0 1 9 3.3c0 3.92-2.8 6.95-8.45 10.73A1 1 0 0 1 12 21z" /></svg></button>
      </div>
      <div className="range-shell"><div className="range-track" /><div className="range-fill" id={interactive ? 'progress-fill' : undefined} style={{ width: `${progress}%` }} />{interactive && <input className="range-input" id="progress-slider" type="range" min="0" max="100" value={progress} onChange={(event) => onSeekPercent?.(Number(event.target.value))} aria-label="再生位置" />}</div>
      <div className="time-row"><span id={interactive ? 'time-current' : undefined}>{formatTime(frameState.currentTime)}</span><span id={interactive ? 'time-total' : undefined}>{formatTime(frameState.duration)}</span></div>
      <div className="transport">
        <button className="icon-button minor active" type="button" aria-label="シャッフル"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3l4 4-4 4V8h-1.4a4 4 0 0 0-3.2 1.6l-1.15 1.53-1.5-2 1.05-1.4A6.5 6.5 0 0 1 15.6 5H17V3zM3 5h3.4a6.5 6.5 0 0 1 5.2 2.6l4 5.33A4 4 0 0 0 18.8 14H21v-3l4 4-4 4v-3h-2.2a6.5 6.5 0 0 1-5.2-2.6l-4-5.33A4 4 0 0 0 6.4 7H3V5zm5.75 8.87 1.5 2-.85 1.13A6.5 6.5 0 0 1 4.2 19H3v-2h1.2a4 4 0 0 0 3.2-1.6l1.35-1.53z" /></svg></button>
        <button className="icon-button skip" type="button" aria-label="前の曲"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2v14H6V5zm12.2.9v12.2a.8.8 0 0 1-1.23.68l-9.2-6.1a.81.81 0 0 1 0-1.36l9.2-6.1a.8.8 0 0 1 1.23.68z" /></svg></button>
        {interactive ? <button className="icon-button play-button" id="btn-play" type="button" aria-label={frameState.playing ? '一時停止' : '再生'} onClick={onPlayToggle}>{frameState.playing ? <svg className="pause-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4.5" width="4.5" height="15" rx="1" /><rect x="13.5" y="4.5" width="4.5" height="15" rx="1" /></svg> : <svg className="play-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.8v12.4c0 .65.72 1.04 1.26.68l9.3-6.2a.82.82 0 0 0 0-1.36l-9.3-6.2A.82.82 0 0 0 8 5.8z" /></svg>}</button> : <span className="icon-button play-button">{frameState.playing ? <svg className="pause-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4.5" width="4.5" height="15" rx="1" /><rect x="13.5" y="4.5" width="4.5" height="15" rx="1" /></svg> : <svg className="play-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.8v12.4c0 .65.72 1.04 1.26.68l9.3-6.2a.82.82 0 0 0 0-1.36l-9.3-6.2A.82.82 0 0 0 8 5.8z" /></svg>}</span>}
        <button className="icon-button skip" type="button" aria-label="次の曲"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5h2v14h-2V5zM5.8 5.9v12.2a.8.8 0 0 0 1.23.68l9.2-6.1a.81.81 0 0 0 0-1.36l-9.2-6.1a.8.8 0 0 0-1.23.68z" /></svg></button>
        <button className="icon-button minor active" type="button" aria-label="リピート"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3l4 4-4 4V8H7a3 3 0 0 0-3 3v1H2v-1a5 5 0 0 1 5-5h10V3zm-10 18-4-4 4-4v3h10a3 3 0 0 0 3-3v-1h2v1a5 5 0 0 1-5 5H7v3z" /></svg></button>
      </div>
      <div className="volume-row"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 5v14a1 1 0 0 1-1.65.76L7 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h3l4.35-3.76A1 1 0 0 1 13 5zm3.3 3.3a1 1 0 0 1 1.4 0 5.23 5.23 0 0 1 0 7.4 1 1 0 0 1-1.4-1.4 3.24 3.24 0 0 0 0-4.6 1 1 0 0 1 0-1.4z" /></svg><div className="range-shell"><div className="range-track" /><div className="range-fill" id={interactive ? 'volume-fill' : undefined} style={{ width: `${volume}%` }} />{interactive && <input className="range-input" id="volume-slider" type="range" min="0" max="100" value={volume} onChange={(event) => onVolumeChange?.(Number(event.target.value) / 100)} aria-label="音量" />}</div></div>
      <div className="device-row"><div className="device-copy"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6l2 3h-2.3l-2-3H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v10h16V5H4z" /></svg><span>This device</span></div><svg className="queue-icon" viewBox="0 0 24 24" aria-label="キュー"><path d="M4 5h16v2H4V5zm0 6h10v2H4v-2zm0 6h10v2H4v-2zm13-5 5 3-5 3v-6z" /></svg></div>
    </article>
  );
}

export default function SpotifyPlayerApp() {
  // ---- フォーム入力 ----
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [currentText, setCurrentText] = useState('0:00');
  const [durationText, setDurationText] = useState('3:30');
  const [youtubeText, setYoutubeText] = useState('');
  const [errors, setErrors] = useState<FormErrors>(NO_ERRORS);
  const uploadedImageRef = useRef<string>(DEFAULT_COVER);

  // ---- 適用済みプレビュー ----
  const [applied, setApplied] = useState({
    title: '曲のタイトル',
    artist: 'アーティスト名',
    cover: DEFAULT_COVER,
  });
  const staticTimeRef = useRef({ current: 0, duration: 210 });
  const [time, setTime] = useState({ current: 0, duration: 210 });
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [status, setStatus] = useState<Status>({ text: '静的プレビューモード', tone: '' });
  const [panelVisible, setPanelVisible] = useState(false);
  const mediaActiveRef = useRef(false);
  const exportingRef = useRef(false);
  const exportWasPlayingRef = useRef(false);
  const [videoExporting, setVideoExporting] = useState(false);

  const cardRef = useRef<HTMLElement | null>(null);
  const exportCardRef = useRef<HTMLElement | null>(null);
  const { capture } = useCapture();
  const localAudio = useLocalAudio();

  const syncPlayerClockRef = useRef<() => boolean>(() => false);

  const yt = useYouTubePlayer({
    width: '272',
    height: '200',
    playerVars: { autoplay: 0, controls: 1, playsinline: 1, origin: location.origin },
    onStateChange: state => {
      if (!window.YT) return;
      if (state === window.YT.PlayerState.PLAYING) {
        setPlaying(true);
        syncPlayerClockRef.current();
        return;
      }

      if (state === window.YT.PlayerState.ENDED) {
        setPlaying(false);
        const duration = yt.getDuration();
        setTime({ current: duration, duration });
      } else if (state === window.YT.PlayerState.PAUSED || state === window.YT.PlayerState.CUED) {
        setPlaying(false);
        if (!syncPlayerClockRef.current()) {
          window.setTimeout(() => syncPlayerClockRef.current(), 300);
        }
      }
    },
    onProgress: (current, duration) => {
      if (!localAudio.file && duration > 0) {
        setTime({ current, duration });
        setStatus({ text: 'YouTubeの再生時間を表示中', tone: 'success' });
      }
    },
    onError: () => {
      mediaActiveRef.current = false;
      setPlaying(false);
      setTime({ ...staticTimeRef.current });
      setStatus({ text: 'YouTube音源を読み込めませんでした。静的プレビューは保存できます。', tone: 'error' });
    },
  });

  syncPlayerClockRef.current = () => {
    if (!mediaActiveRef.current) return false;
    try {
      const duration = yt.getDuration();
      const current = yt.getCurrentTime();
      if (duration > 0) {
        setTime({ current, duration });
        setStatus({ text: 'YouTubeの再生時間を表示中', tone: 'success' });
        return true;
      }
    } catch {
      // プレーヤーの状態遷移中は静的プレビューを表示し続ける
    }
    return false;
  };

  // プレーヤー準備完了時: 音量を反映し、cue 済みトラックの時間表示を同期する
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  useEffect(() => {
    if (!yt.ready || !mediaActiveRef.current) return;
    yt.setVolume(volumeRef.current);
    const timer = window.setTimeout(() => syncPlayerClockRef.current(), 300);
    return () => window.clearTimeout(timer);
  }, [yt.ready, yt]);

  useEffect(() => {
    if (!localAudio.file || exportingRef.current) return;
    setTime({ current: localAudio.currentTime, duration: localAudio.duration });
    setPlaying(localAudio.playing);
    setVolume(localAudio.volume * 100);
  }, [localAudio.currentTime, localAudio.duration, localAudio.file, localAudio.playing, localAudio.volume]);

  function validateForm() {
    const nextErrors: FormErrors = { ...NO_ERRORS, image: errors.image };
    const current = parseTime(currentText);
    const duration = parseTime(durationText);
    const youtubeValue = youtubeText.trim();
    const youtubeId = extractYouTubeId(youtubeValue);
    let valid = true;

    if (current === null) {
      nextErrors.current = 'm:ss 形式で入力してください';
      valid = false;
    }
    if (duration === null) {
      nextErrors.duration = 'm:ss 形式で入力してください';
      valid = false;
    } else if (duration < 1) {
      nextErrors.duration = '曲の長さは1秒以上にしてください';
      valid = false;
    }
    if (current !== null && duration !== null && current > duration) {
      nextErrors.current = '曲の長さ以下にしてください';
      valid = false;
    }
    if (youtubeValue && !youtubeId) {
      nextErrors.youtube = '対応しているURLまたは11文字の動画IDを入力してください';
      valid = false;
    }

    setErrors(nextErrors);
    if (!valid) return null;
    return {
      title: title.trim() || '曲のタイトル',
      artist: artist.trim() || 'アーティスト名',
      current: current!,
      duration: duration!,
      youtubeId,
    };
  }

  function applyPreview(event: FormEvent) {
    event.preventDefault();
    if (exportingRef.current) return;
    const values = validateForm();
    if (!values) return;

    staticTimeRef.current = { current: values.current, duration: values.duration };
    setApplied({ title: values.title, artist: values.artist, cover: uploadedImageRef.current });
    setTime(localAudio.file
      ? { current: localAudio.currentTime, duration: localAudio.duration }
      : { current: values.current, duration: values.duration });
    setPlaying(false);

    if (localAudio.file) {
      mediaActiveRef.current = false;
      setPanelVisible(false);
      yt.stop();
      setStatus({ text: 'ローカル音源の再生時間を表示中', tone: 'success' });
    } else if (values.youtubeId) {
      mediaActiveRef.current = true;
      setPanelVisible(true);
      setStatus({ text: 'YouTube音源を準備しています…', tone: '' });
      yt.cueVideo(values.youtubeId, values.current);
      if (yt.ready) yt.setVolume(volume);
    } else {
      mediaActiveRef.current = false;
      setPanelVisible(false);
      yt.stop();
      setStatus({ text: '静的プレビューモード', tone: '' });
    }
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    if (exportingRef.current) return;
    const file = event.target.files?.[0];
    setErrors(prev => ({ ...prev, image: '' }));
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, image: '画像ファイルを選択してください' }));
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      uploadedImageRef.current = String(reader.result);
    };
    reader.onerror = () => {
      setErrors(prev => ({ ...prev, image: '画像を読み込めませんでした' }));
    };
    reader.readAsDataURL(file);
  }

  function handlePlayClick() {
    if (exportingRef.current) return;
    if (localAudio.file) {
      yt.stop();
      if (localAudio.playing) localAudio.pause();
      else void localAudio.play();
      return;
    }
    if (!mediaActiveRef.current) {
      setStatus({ text: '再生するにはYouTube URLを設定して適用してください', tone: 'error' });
      return;
    }
    if (!yt.ready) {
      setStatus({ text: 'YouTube音源を準備しています…', tone: '' });
      return;
    }

    if (playing) yt.pause();
    else yt.play();
  }

  function handleProgressInput(percentage: number) {
    if (exportingRef.current) return;
    if (localAudio.file) {
      const duration = localAudio.duration;
      const nextTime = duration > 0 ? duration * (percentage / 100) : 0;
      localAudio.seek(nextTime);
      setTime({ current: nextTime, duration });
      return;
    }

    if (mediaActiveRef.current && yt.ready) {
      const duration = yt.getDuration();
      if (duration > 0) {
        const nextTime = duration * (percentage / 100);
        yt.seekTo(nextTime);
        setTime({ current: nextTime, duration });
      }
      return;
    }

    const nextCurrent = staticTimeRef.current.duration * (percentage / 100);
    staticTimeRef.current = { ...staticTimeRef.current, current: nextCurrent };
    setCurrentText(formatTime(nextCurrent));
    setTime({ current: nextCurrent, duration: staticTimeRef.current.duration });
  }

  function handleVolumeInput(nextVolume: number) {
    if (exportingRef.current) return;
    const safeVolume = Math.min(Math.max(nextVolume, 0), 1);
    setVolume(safeVolume * 100);
    if (localAudio.file) localAudio.setVolume(safeVolume);
    else if (yt.ready) yt.setVolume(safeVolume * 100);
  }

  function handleAudioFileChange(file: File | null) {
    if (exportingRef.current) return;
    if (!file) {
      localAudio.clear();
      setPlaying(false);
      setTime({ ...staticTimeRef.current });
      setStatus({ text: '静的プレビューモード', tone: '' });
      return;
    }
    mediaActiveRef.current = false;
    setPanelVisible(false);
    yt.stop();
    localAudio.pause();
    void localAudio.selectFile(file);
    localAudio.setVolume(volume / 100);
    setStatus({ text: 'ローカル音源を準備しています…', tone: '' });
  }

  function handleVideoFrame(nextFrame: PlayerFrameState): Promise<void> {
    return new Promise((resolve) => {
      setTime({ current: nextFrame.currentTime, duration: nextFrame.duration });
      setPlaying(nextFrame.playing);
      setVolume(nextFrame.volume * 100);
      requestAnimationFrame(() => resolve());
    });
  }

  async function handleCapture() {
    setStatus({ text: '画像を生成しています…', tone: '' });
    try {
      await capture(cardRef.current!, 'spotify_player.png');
      setStatus({ text: '画像を保存しました', tone: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus({ text: `画像の生成に失敗しました: ${message}`, tone: 'error' });
    }
  }

  function handleExportStart() {
    exportingRef.current = true;
    exportWasPlayingRef.current = localAudio.playing;
    setVideoExporting(true);
    if (localAudio.playing) localAudio.pause();
    setPlaying(false);
  }

  function handleExportEnd() {
    const shouldResume = exportWasPlayingRef.current;
    exportingRef.current = false;
    setVideoExporting(false);
    setTime({ current: localAudio.currentTime, duration: localAudio.duration });
    setPlaying(shouldResume);
    if (shouldResume) void localAudio.play();
  }

  const frameState: PlayerFrameState = {
    currentTime: time.current,
    duration: time.duration,
    progress: time.duration > 0 ? time.current / time.duration : 0,
    playing,
    volume: volume / 100,
  };
  return (
    <div className="app-spotify">
      <div className="app-shell">
        <section className={`preview-stage${videoExporting ? ' video-export-lock' : ''}`} aria-label="プレーヤープレビュー">
          <SpotifyPlayerCard
            applied={applied}
            frameState={frameState}
            cardRef={cardRef}
            interactive
            onPlayToggle={handlePlayClick}
            onSeekPercent={handleProgressInput}
            onVolumeChange={handleVolumeInput}
          />
        </section>
        <div className="video-export-card" aria-hidden="true"><SpotifyPlayerCard applied={applied} frameState={frameState} cardRef={exportCardRef} /></div>

        <aside className="editor" aria-label="編集パネル">
          <div className="editor-header">
            <div className="editor-title-wrap"><span className="brand-dot" /><h1>Spotify style</h1></div>
            <ThemeToggle className="theme-toggle" disabled={videoExporting} />
          </div>

          <form className="form" id="player-form" noValidate onSubmit={applyPreview}>
            <div>
              <label className="field-label" htmlFor="in-title">Title</label>
              <input
                className="field-input"
                id="in-title"
                type="text"
                placeholder="曲のタイトル"
                value={title}
                disabled={videoExporting}
                onChange={event => setTitle(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="in-artist">Artist</label>
              <input
                className="field-input"
                id="in-artist"
                type="text"
                placeholder="アーティスト名"
                value={artist}
                disabled={videoExporting}
                onChange={event => setArtist(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="in-image">Artwork</label>
              <input className="file-input" id="in-image" type="file" accept="image/*" disabled={videoExporting} onChange={handleImageChange} />
              <p className="field-error" id="error-image" aria-live="polite">{errors.image}</p>
            </div>
            <div className="time-fields">
              <div>
                <label className="field-label" htmlFor="in-current-time">Position</label>
                <input
                  className="field-input"
                  id="in-current-time"
                  type="text"
                  inputMode="numeric"
                  value={currentText}
                  disabled={videoExporting}
                  onChange={event => setCurrentText(event.target.value)}
                  aria-invalid={errors.current ? true : false}
                  aria-describedby="error-current-time"
                />
                <p className="field-error" id="error-current-time" aria-live="polite">{errors.current}</p>
              </div>
              <div>
                <label className="field-label" htmlFor="in-duration">Duration</label>
                <input
                  className="field-input"
                  id="in-duration"
                  type="text"
                  inputMode="numeric"
                  value={durationText}
                  disabled={videoExporting}
                  onChange={event => setDurationText(event.target.value)}
                  aria-invalid={errors.duration ? true : false}
                  aria-describedby="error-duration"
                />
                <p className="field-error" id="error-duration" aria-live="polite">{errors.duration}</p>
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="in-youtube">YouTube URL</label>
              <input
                className="field-input"
                id="in-youtube"
                type="text"
                placeholder="URL または動画ID"
                value={youtubeText}
                disabled={videoExporting}
                onChange={event => setYoutubeText(event.target.value)}
                aria-invalid={errors.youtube ? true : false}
                aria-describedby="youtube-help error-youtube"
              />
              <p className="field-help" id="youtube-help">未入力でも静的画像を生成できます</p>
              <p className="field-error" id="error-youtube" aria-live="polite">{errors.youtube}</p>
            </div>
            <div className="youtube-player-panel" id="youtube-player-panel" hidden={!panelVisible}>
              <div id="youtube-audio" aria-label="YouTube プレーヤー" ref={yt.containerRef} />
            </div>
            <p className="playback-status" id="playback-status" aria-live="polite" data-tone={status.tone}>
              {status.text}
            </p>
            <div className="actions">
              <button className="primary-button" id="btn-update" type="submit" disabled={videoExporting}>適用してプレビュー</button>
            </div>
            <VideoExportPanel
              appId="spotify-player"
              exportCardRef={exportCardRef}
              audio={localAudio}
              onAudioFileChange={handleAudioFileChange}
              frameState={frameState}
              duration={frameState.duration}
              currentTime={frameState.currentTime}
              onSeek={(seconds) => handleProgressInput(frameState.duration > 0 ? seconds / frameState.duration * 100 : 0)}
              onFrame={handleVideoFrame}
              volume={frameState.volume}
              onVolumeChange={handleVolumeInput}
              onImageSave={handleCapture}
              onExportStart={handleExportStart}
              onExportEnd={handleExportEnd}
              onPreviewStart={(range) => {
                if (exportingRef.current) return;
                localAudio.seek(range.start);
                void localAudio.play();
              }}
              onPreviewStop={() => {
                if (!exportingRef.current) localAudio.pause();
              }}
            />
          </form>
        </aside>
      </div>
    </div>
  );
}
