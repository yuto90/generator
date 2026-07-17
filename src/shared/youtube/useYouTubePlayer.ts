import { useCallback, useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    YT?: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// window.onYouTubeIframeAPIReady はグローバルに 1 つしか持てないため、
// API の読み込みはモジュールレベルのシングルトンに集約する(SPA 化で必須になった制約)。
let apiPromise: Promise<typeof YT> | null = null;

export function loadYouTubeApi(): Promise<typeof YT> {
  if (window.YT?.Player) return Promise.resolve(window.YT);

  apiPromise ??= new Promise(resolve => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });

  return apiPromise;
}

export interface UseYouTubePlayerOptions {
  /** 非表示プレーヤーは '1' x '1'、spotify の表示型は '272' x '200' */
  width: string;
  height: string;
  playerVars?: YT.PlayerVars;
  onStateChange?: (state: YT.PlayerState) => void;
  /** 再生中に一定間隔で現在位置を通知する(旧実装の setInterval 500ms を共通化) */
  onProgress?: (currentTime: number, duration: number) => void;
  progressIntervalMs?: number;
}

export interface YouTubePlayerHandle {
  /** プレーヤー iframe を挿し込む要素に渡す ref */
  containerRef: (element: HTMLDivElement | null) => void;
  ready: boolean;
  /** 動画を読み込む。プレーヤー未生成なら生成し、生成済みなら cueVideoById する */
  cueVideo: (videoId: string) => void;
  play: () => void;
  pause: () => void;
  seekToPercent: (percent: number) => void;
  setVolume: (volume: number) => void;
  getDuration: () => number;
  getCurrentTime: () => number;
}

export function useYouTubePlayer(options: UseYouTubePlayerOptions): YouTubePlayerHandle {
  const { width, height, progressIntervalMs = 500 } = options;
  const containerElRef = useRef<HTMLDivElement | null>(null);
  const mountElRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const creatingRef = useRef(false);
  const pendingVideoIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unmountedRef = useRef(false);
  const [ready, setReady] = useState(false);

  // コールバックの最新版を ref 経由で参照し、YT イベントの stale closure を避ける
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const containerRef = useCallback((element: HTMLDivElement | null) => {
    containerElRef.current = element;
  }, []);

  const stopProgressTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleStateChange = useCallback((event: YT.OnStateChangeEvent) => {
    const player = playerRef.current;
    if (!player) return;

    if (event.data === YT.PlayerState.PLAYING) {
      stopProgressTimer();
      timerRef.current = setInterval(() => {
        const current = playerRef.current;
        if (!current || typeof current.getDuration !== 'function') return;
        optionsRef.current.onProgress?.(current.getCurrentTime(), current.getDuration());
      }, progressIntervalMs);
    } else {
      stopProgressTimer();
    }

    optionsRef.current.onStateChange?.(event.data);
  }, [progressIntervalMs, stopProgressTimer]);

  const createPlayer = useCallback(async (videoId: string) => {
    if (creatingRef.current) {
      pendingVideoIdRef.current = videoId;
      return;
    }
    creatingRef.current = true;
    pendingVideoIdRef.current = videoId;

    const yt = await loadYouTubeApi();
    const container = containerElRef.current;
    if (unmountedRef.current || !container) {
      creatingRef.current = false;
      return;
    }

    // YT.Player は渡した要素を iframe に置き換えるため、React 管理下の要素は渡さず
    // 使い捨ての子要素を挟む
    const mount = document.createElement('div');
    container.appendChild(mount);
    mountElRef.current = mount;

    playerRef.current = new yt.Player(mount, {
      width,
      height,
      videoId: pendingVideoIdRef.current ?? videoId,
      playerVars: optionsRef.current.playerVars,
      events: {
        onReady: () => {
          if (!unmountedRef.current) setReady(true);
        },
        onStateChange: handleStateChange,
      },
    });
  }, [width, height, handleStateChange]);

  const cueVideo = useCallback((videoId: string) => {
    const player = playerRef.current;
    if (player && typeof player.cueVideoById === 'function') {
      player.cueVideoById(videoId);
    } else {
      void createPlayer(videoId);
    }
  }, [createPlayer]);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      // ルート遷移後に音が鳴り続けないよう必ず破棄する(iframe 廃止に伴う新規要件)
      unmountedRef.current = true;
      stopProgressTimer();
      playerRef.current?.destroy();
      playerRef.current = null;
      mountElRef.current?.remove();
      mountElRef.current = null;
    };
  }, [stopProgressTimer]);

  return {
    containerRef,
    ready,
    cueVideo,
    play: useCallback(() => playerRef.current?.playVideo(), []),
    pause: useCallback(() => playerRef.current?.pauseVideo(), []),
    seekToPercent: useCallback((percent: number) => {
      const player = playerRef.current;
      if (player && typeof player.getDuration === 'function') {
        player.seekTo(player.getDuration() * (percent / 100), true);
      }
    }, []),
    setVolume: useCallback((volume: number) => playerRef.current?.setVolume(volume), []),
    getDuration: useCallback(() => playerRef.current?.getDuration() ?? 0, []),
    getCurrentTime: useCallback(() => playerRef.current?.getCurrentTime() ?? 0, []),
  };
}
