export interface VideoClipRange {
  start: number;
  end: number;
  duration: number;
}

export interface PlayerFrameState {
  currentTime: number;
  duration: number;
  progress: number;
  playing: boolean;
  volume: number;
}

export interface LocalAudioState {
  file: File | null;
  buffer: AudioBuffer | null;
  duration: number;
  currentTime: number;
  playing: boolean;
  volume: number;
  error: string;
}
