import { useCallback, useEffect, useRef, useState } from 'react';
import type { LocalAudioState } from './video-types';

interface LocalAudioControls extends LocalAudioState {
  selectFile: (file: File) => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  clear: () => void;
}

const initialState: LocalAudioState = {
  file: null,
  buffer: null,
  duration: 0,
  currentTime: 0,
  playing: false,
  volume: 1,
  error: '',
};

export function useLocalAudio(): LocalAudioControls {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [state, setState] = useState<LocalAudioState>(initialState);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) {
        setState((current) => ({ ...current, duration: audio.duration }));
      }
    };
    const onTimeUpdate = () => setState((current) => ({ ...current, currentTime: audio.currentTime }));
    const onEnded = () => setState((current) => ({ ...current, playing: false, currentTime: audio.duration }));

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      revokeObjectUrl();
      audioRef.current = null;
    };
  }, [revokeObjectUrl]);

  const selectFile = useCallback(async (file: File) => {
    const audio = audioRef.current;
    if (!audio) return;

    revokeObjectUrl();
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    audio.pause();
    audio.src = objectUrl;
    audio.currentTime = 0;
    setState((current) => ({ ...current, file, buffer: null, duration: 0, currentTime: 0, playing: false, error: '' }));

    let context: AudioContext | null = null;
    try {
      const AudioContextConstructor = window.AudioContext
        ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor || !file.arrayBuffer) return;

      context = new AudioContextConstructor();
      const buffer = await context.decodeAudioData(await file.arrayBuffer());
      if (objectUrlRef.current === objectUrl) {
        setState((current) => ({ ...current, buffer }));
      }
    } catch {
      if (objectUrlRef.current === objectUrl) {
        setState((current) => ({ ...current, error: '音源を読み込めませんでした。' }));
      }
    } finally {
      if (context) {
        try {
          await context.close();
        } catch {
          // 解放失敗はデコード結果に影響させない
        }
      }
    }
  }, [revokeObjectUrl]);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !objectUrlRef.current) return;

    try {
      await audio.play();
      setState((current) => ({ ...current, playing: true, error: '' }));
    } catch {
      setState((current) => ({ ...current, playing: false, error: '音源を再生できませんでした。' }));
    }
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setState((current) => ({ ...current, playing: false }));
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(time)) return;

    const duration = Number.isFinite(audio.duration) ? audio.duration : Number.POSITIVE_INFINITY;
    const currentTime = Math.min(Math.max(time, 0), duration);
    audio.currentTime = currentTime;
    setState((current) => ({ ...current, currentTime }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    if (!Number.isFinite(volume)) return;

    const nextVolume = Math.min(Math.max(volume, 0), 1);
    if (audioRef.current) audioRef.current.volume = nextVolume;
    setState((current) => ({ ...current, volume: nextVolume }));
  }, []);

  const clear = useCallback(() => {
    const audio = audioRef.current;
    audio?.pause();
    if (audio) {
      audio.removeAttribute('src');
      audio.load();
    }
    revokeObjectUrl();
    setState((current) => ({ ...initialState, volume: current.volume }));
  }, [revokeObjectUrl]);

  return { ...state, selectFile, play, pause, seek, setVolume, clear };
}
