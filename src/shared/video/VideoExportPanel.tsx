import { useEffect, useMemo, useRef, useState } from 'react';
import { exportPlayerVideo, type VideoExportPhase } from './video-exporter';
import { calculateVideoClipRange, parseVideoStartTime } from './video-timeline';
import type { LocalAudioState, PlayerFrameState } from './video-types';
import './video-export-panel.css';

export interface VideoExportPanelProps {
  appId: string;
  exportCardRef: React.RefObject<HTMLElement | null>;
  audio: LocalAudioState;
  onAudioFileChange: (file: File | null) => void;
  frameState: PlayerFrameState;
  duration: number;
  currentTime: number;
  onSeek: (seconds: number) => void;
  onFrame: (state: PlayerFrameState) => Promise<void>;
  volume: number;
  onVolumeChange: (volume: number) => void;
  /** 既存のPNG保存処理を画像タブから呼び出す。 */
  onImageSave?: () => void | Promise<void>;
}

type ExportStatus = 'idle' | 'generating' | 'completed' | 'failed' | 'cancelled';

function formatTime(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

function progressText(phase: VideoExportPhase, progress: number): string {
  if (phase === 'preparing') return '準備中';
  if (phase === 'rendering') return `フレーム生成中（${Math.round(progress * 100)}%）`;
  if (phase === 'muxing') return 'MP4仕上げ中';
  if (phase === 'completed') return 'MP4を保存しました。';
  return '';
}

export function VideoExportPanel({
  appId,
  exportCardRef,
  audio,
  onAudioFileChange,
  frameState,
  duration,
  currentTime,
  onSeek,
  onFrame,
  volume,
  onVolumeChange,
  onImageSave,
}: VideoExportPanelProps) {
  const [tab, setTab] = useState<'image' | 'video'>('image');
  const [startText, setStartText] = useState(() => formatTime(currentTime));
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [phaseText, setPhaseText] = useState('');
  const [error, setError] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const start = parseVideoStartTime(startText);
  const range = useMemo(
    () => start === null ? null : calculateVideoClipRange(audio.duration, start),
    [audio.duration, start],
  );
  const generating = status === 'generating';
  const canExport = !generating && Boolean(audio.buffer) && Boolean(range);
  const inputError = audio.error || (!audio.buffer ? '動画出力にはローカル音源を選択してください。' : '');

  useEffect(() => {
    if (!generating) setStartText(formatTime(currentTime));
  }, [currentTime, generating]);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const changeStartTime = (value: string) => {
    setStartText(value);
    const nextStart = parseVideoStartTime(value);
    if (nextStart !== null) onSeek(nextStart);
  };

  const saveVideo = async () => {
    if (!audio.buffer) {
      setError('動画出力にはローカル音源を選択してください。');
      setStatus('failed');
      return;
    }
    if (!range) {
      setError('開始位置を音源の範囲内で入力してください。');
      setStatus('failed');
      return;
    }
    const card = exportCardRef.current;
    if (!card) {
      setError('出力するカードを取得できませんでした。');
      setStatus('failed');
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setStatus('generating');
    setError('');
    setPhaseText('準備中');

    try {
      const blob = await exportPlayerVideo({
        card,
        range,
        audio: audio.buffer,
        volume,
        onFrame: (state) => onFrame({ ...frameState, ...state }),
        signal: controller.signal,
        onProgress: (phase, progress) => setPhaseText(progressText(phase, progress)),
      });
      if (controller.signal.aborted) {
        setStatus('cancelled');
        setPhaseText('動画の生成をキャンセルしました。');
        return;
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${appId}.mp4`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus('completed');
      setPhaseText(`MP4を保存しました（${formatTime(range.duration)}）。`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'MP4の生成に失敗しました。';
      if (controller.signal.aborted || message === '動画の生成をキャンセルしました。') {
        setStatus('cancelled');
        setPhaseText('動画の生成をキャンセルしました。');
      } else {
        setStatus('failed');
        setError(message);
        setPhaseText('');
      }
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  };

  const cancel = () => abortControllerRef.current?.abort();

  return (
    <section className="video-export-panel" aria-label="保存形式">
      <div className="video-export-panel__tabs" role="tablist" aria-label="保存形式">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'image'}
          aria-controls="image-export-panel"
          disabled={generating}
          onClick={() => setTab('image')}
        >
          画像
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'video'}
          aria-controls="video-export-panel"
          disabled={generating}
          onClick={() => setTab('video')}
        >
          動画
        </button>
      </div>

      {tab === 'image' ? (
        <div id="image-export-panel" role="tabpanel" aria-label="画像保存">
          <button type="button" className="video-export-panel__save" disabled={generating} onClick={() => { void onImageSave?.(); }}>
            画像として保存
          </button>
        </div>
      ) : (
        <div id="video-export-panel" role="tabpanel" aria-label="動画保存" className="video-export-panel__content">
          <label className="video-export-panel__label" htmlFor={`${appId}-video-audio`}>ローカル音源（動画用）</label>
          <input
            id={`${appId}-video-audio`}
            type="file"
            accept="audio/*"
            disabled={generating}
            onChange={(event) => onAudioFileChange(event.target.files?.[0] ?? null)}
          />
          {audio.file && <p className="video-export-panel__file">選択中: {audio.file.name}</p>}

          <label className="video-export-panel__label" htmlFor={`${appId}-video-start`}>動画開始位置（m:ss）</label>
          <input
            id={`${appId}-video-start`}
            type="text"
            inputMode="numeric"
            value={startText}
            disabled={generating}
            onChange={(event) => changeStartTime(event.target.value)}
          />
          <label className="video-export-panel__label" htmlFor={`${appId}-video-start-slider`}>動画開始位置スライダー</label>
          <input
            id={`${appId}-video-start-slider`}
            type="range"
            min="0"
            max={Math.max(duration, audio.duration, 0)}
            step="0.1"
            value={start ?? 0}
            disabled={generating}
            onChange={(event) => {
              const seconds = Number(event.target.value);
              setStartText(formatTime(seconds));
              onSeek(seconds);
            }}
          />
          <p className="video-export-panel__range">
            {range ? `出力範囲: ${formatTime(range.start)}–${formatTime(range.end)}` : '出力範囲を確認してください。'}
          </p>
          <label className="video-export-panel__label" htmlFor={`${appId}-video-volume`}>動画の音量</label>
          <input
            id={`${appId}-video-volume`}
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            disabled={generating}
            onChange={(event) => onVolumeChange(Number(event.target.value))}
          />
          <p className="video-export-panel__info">MP4・30fps・幅1080px</p>
          <p className="video-export-panel__notice">YouTube音声は動画へ出力されません</p>
          {inputError && <p className="video-export-panel__error" role="alert">{inputError}</p>}
          {!range && audio.buffer && <p className="video-export-panel__error" role="alert">開始位置を音源の範囲内で入力してください。</p>}
          {phaseText && <p className="video-export-panel__progress" aria-live="polite">{phaseText}</p>}
          {error && <p className="video-export-panel__error" role="alert">{error}</p>}

          <div className="video-export-panel__actions">
            <button type="button" className="video-export-panel__save" disabled={!canExport} onClick={() => { void saveVideo(); }}>
              MP4として保存
            </button>
            {generating && <button type="button" onClick={cancel}>キャンセル</button>}
            {status === 'failed' && <button type="button" disabled={!canExport} onClick={() => { void saveVideo(); }}>もう一度生成</button>}
          </div>
        </div>
      )}

    </section>
  );
}
