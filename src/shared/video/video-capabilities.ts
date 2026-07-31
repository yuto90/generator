import { canEncodeAudio, canEncodeVideo } from 'mediabunny';

export interface VideoCapabilityState {
  supported: boolean;
  video: boolean;
  audio: boolean;
  message: string;
}

const VIDEO_BITRATE = 8_000_000;
const AUDIO_BITRATE = 128_000;

export async function detectVideoCapabilities(width: number, height: number): Promise<VideoCapabilityState> {
  const [video, audio] = await Promise.all([
    canEncodeVideo('avc', { width, height, bitrate: VIDEO_BITRATE }),
    canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: 48_000, bitrate: AUDIO_BITRATE }),
  ]);

  if (!video && !audio) {
    return {
      supported: false,
      video,
      audio,
      message: 'H.264 映像エンコーダーと AAC 音声エンコーダーに対応していないブラウザです。',
    };
  }

  if (!video) {
    return {
      supported: false,
      video,
      audio,
      message: 'H.264 映像エンコーダーに対応していないブラウザです。',
    };
  }

  if (!audio) {
    return {
      supported: false,
      video,
      audio,
      message: 'AAC 音声エンコーダーに対応していないブラウザです。',
    };
  }

  return { supported: true, video, audio, message: '' };
}
