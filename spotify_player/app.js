import {
  readTheme,
  writeTheme,
  applyTheme,
  isThemeMessage,
  postTheme,
} from '../theme.js';
import {
  parseTime,
  formatTime,
  calculateProgress,
  extractYouTubeId,
} from './player-utils.js';

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

const elements = {
  form: document.getElementById('player-form'),
  titleInput: document.getElementById('in-title'),
  artistInput: document.getElementById('in-artist'),
  imageInput: document.getElementById('in-image'),
  currentInput: document.getElementById('in-current-time'),
  durationInput: document.getElementById('in-duration'),
  youtubeInput: document.getElementById('in-youtube'),
  youtubePanel: document.getElementById('youtube-player-panel'),
  card: document.getElementById('player-card'),
  cover: document.getElementById('cover-img'),
  title: document.getElementById('song-title'),
  artist: document.getElementById('song-artist'),
  currentTime: document.getElementById('time-current'),
  totalTime: document.getElementById('time-total'),
  progress: document.getElementById('progress-slider'),
  progressFill: document.getElementById('progress-fill'),
  volume: document.getElementById('volume-slider'),
  volumeFill: document.getElementById('volume-fill'),
  playButton: document.getElementById('btn-play'),
  playIcon: document.querySelector('.play-icon'),
  pauseIcon: document.querySelector('.pause-icon'),
  captureButton: document.getElementById('btn-capture'),
  status: document.getElementById('playback-status'),
  imageError: document.getElementById('error-image'),
  currentError: document.getElementById('error-current-time'),
  durationError: document.getElementById('error-duration'),
  youtubeError: document.getElementById('error-youtube'),
  themeToggle: document.querySelector('[data-theme-toggle]'),
};

let uploadedImageSrc = DEFAULT_COVER;
let staticCurrent = 0;
let staticDuration = 210;
let player = null;
let playerReady = false;
let mediaActive = false;
let pendingTrack = null;
let clockTimer = null;
let isPlaying = false;
let currentTheme = applyTheme(document.documentElement, elements.themeToggle, readTheme());

function setStatus(message, tone = '') {
  elements.status.textContent = message;
  elements.status.dataset.tone = tone;
}

function setFieldError(input, errorElement, message) {
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  errorElement.textContent = message;
}

function clearFormErrors() {
  setFieldError(elements.currentInput, elements.currentError, '');
  setFieldError(elements.durationInput, elements.durationError, '');
  setFieldError(elements.youtubeInput, elements.youtubeError, '');
}

function renderTime(current, duration) {
  const progress = calculateProgress(current, duration);
  elements.currentTime.textContent = formatTime(current);
  elements.totalTime.textContent = formatTime(duration);
  elements.progress.value = String(progress);
  elements.progressFill.style.width = `${progress}%`;
}

function setPlaying(playing) {
  isPlaying = playing;
  elements.playIcon.style.display = playing ? 'none' : 'block';
  elements.pauseIcon.style.display = playing ? 'block' : 'none';
  elements.playButton.setAttribute('aria-label', playing ? '一時停止' : '再生');
}

function setTheme(theme, persist = true, notifyParent = true) {
  currentTheme = applyTheme(document.documentElement, elements.themeToggle, theme);
  if (persist) writeTheme(window.localStorage, currentTheme);
  if (notifyParent && window.parent !== window) {
    postTheme(window.parent, location.origin, currentTheme);
  }
}

function validateForm() {
  clearFormErrors();

  const current = parseTime(elements.currentInput.value);
  const duration = parseTime(elements.durationInput.value);
  const youtubeValue = elements.youtubeInput.value.trim();
  const youtubeId = extractYouTubeId(youtubeValue);
  let valid = true;

  if (current === null) {
    setFieldError(elements.currentInput, elements.currentError, 'm:ss 形式で入力してください');
    valid = false;
  }
  if (duration === null) {
    setFieldError(elements.durationInput, elements.durationError, 'm:ss 形式で入力してください');
    valid = false;
  } else if (duration < 1) {
    setFieldError(elements.durationInput, elements.durationError, '曲の長さは1秒以上にしてください');
    valid = false;
  }
  if (current !== null && duration !== null && current > duration) {
    setFieldError(elements.currentInput, elements.currentError, '曲の長さ以下にしてください');
    valid = false;
  }
  if (youtubeValue && !youtubeId) {
    setFieldError(elements.youtubeInput, elements.youtubeError, '対応しているURLまたは11文字の動画IDを入力してください');
    valid = false;
  }

  if (!valid) return null;
  return {
    title: elements.titleInput.value.trim() || '曲のタイトル',
    artist: elements.artistInput.value.trim() || 'アーティスト名',
    current,
    duration,
    youtubeId,
  };
}

function applyPreview() {
  const values = validateForm();
  if (!values) return;

  staticCurrent = values.current;
  staticDuration = values.duration;
  elements.title.textContent = values.title;
  elements.artist.textContent = values.artist;
  elements.cover.style.backgroundImage = `url("${uploadedImageSrc}")`;
  renderTime(staticCurrent, staticDuration);
  setPlaying(false);

  if (values.youtubeId) {
    pendingTrack = { videoId: values.youtubeId, startSeconds: values.current };
    elements.youtubePanel.hidden = false;
    setStatus('YouTube音源を準備しています…');
    loadYouTubeApi();
    preparePlayer();
  } else {
    pendingTrack = null;
    mediaActive = false;
    elements.youtubePanel.hidden = true;
    clearClock();
    if (playerReady && typeof player.stopVideo === 'function') player.stopVideo();
    setStatus('静的プレビューモード');
  }
}

function clearClock() {
  if (clockTimer !== null) window.clearInterval(clockTimer);
  clockTimer = null;
}

function syncPlayerClock() {
  if (!playerReady || !mediaActive) return false;
  try {
    const duration = player.getDuration();
    const current = player.getCurrentTime();
    if (duration > 0) {
      renderTime(current, duration);
      setStatus('YouTubeの再生時間を表示中', 'success');
      return true;
    }
  } catch {
    // The static preview remains visible while the player transitions states.
  }
  return false;
}

function startClock() {
  clearClock();
  syncPlayerClock();
  clockTimer = window.setInterval(syncPlayerClock, 500);
}

function cuePendingTrack() {
  if (!playerReady || !pendingTrack) return;
  const track = pendingTrack;
  pendingTrack = null;
  mediaActive = true;
  player.cueVideoById({ videoId: track.videoId, startSeconds: track.startSeconds });
  player.setVolume(Number(elements.volume.value));
  window.setTimeout(syncPlayerClock, 300);
}

function onPlayerStateChange(event) {
  if (!window.YT) return;
  if (event.data === window.YT.PlayerState.PLAYING) {
    setPlaying(true);
    startClock();
    return;
  }

  clearClock();
  if (event.data === window.YT.PlayerState.ENDED) {
    setPlaying(false);
    const duration = player.getDuration();
    renderTime(duration, duration);
  } else if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.CUED) {
    setPlaying(false);
    if (!syncPlayerClock()) window.setTimeout(syncPlayerClock, 300);
  }
}

function handlePlayerError() {
  mediaActive = false;
  pendingTrack = null;
  clearClock();
  setPlaying(false);
  renderTime(staticCurrent, staticDuration);
  setStatus('YouTube音源を読み込めませんでした。静的プレビューは保存できます。', 'error');
}

function createPlayer() {
  if (player || !window.YT?.Player) return;
  player = new window.YT.Player('youtube-audio', {
    height: '200',
    width: '272',
    playerVars: { autoplay: 0, controls: 1, playsinline: 1, origin: location.origin },
    events: {
      onReady: () => {
        playerReady = true;
        cuePendingTrack();
      },
      onStateChange: onPlayerStateChange,
      onError: handlePlayerError,
    },
  });
}

function preparePlayer() {
  if (playerReady) {
    cuePendingTrack();
  } else if (window.YT?.Player) {
    createPlayer();
  }
}

window.onYouTubeIframeAPIReady = () => {
  createPlayer();
};

function loadYouTubeApi() {
  if (window.YT?.Player || document.querySelector('script[data-youtube-api]')) return;
  const script = document.createElement('script');
  script.src = 'https://www.youtube.com/iframe_api';
  script.dataset.youtubeApi = 'true';
  script.onerror = () => {
    if (pendingTrack) handlePlayerError();
  };
  document.head.appendChild(script);
}

elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  applyPreview();
});

elements.imageInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  elements.imageError.textContent = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    elements.imageError.textContent = '画像ファイルを選択してください';
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    uploadedImageSrc = reader.result;
  };
  reader.onerror = () => {
    elements.imageError.textContent = '画像を読み込めませんでした';
  };
  reader.readAsDataURL(file);
});

elements.playButton.addEventListener('click', () => {
  if (!mediaActive) {
    setStatus('再生するにはYouTube URLを設定して適用してください', 'error');
    return;
  }
  if (!playerReady) {
    setStatus('YouTube音源を準備しています…');
    return;
  }

  if (isPlaying) player.pauseVideo();
  else player.playVideo();
});

elements.progress.addEventListener('input', (event) => {
  const percentage = Number(event.target.value);
  elements.progressFill.style.width = `${percentage}%`;

  if (mediaActive && playerReady) {
    const duration = player.getDuration();
    if (duration > 0) {
      const nextTime = duration * (percentage / 100);
      player.seekTo(nextTime, true);
      renderTime(nextTime, duration);
    }
    return;
  }

  staticCurrent = staticDuration * (percentage / 100);
  elements.currentInput.value = formatTime(staticCurrent);
  renderTime(staticCurrent, staticDuration);
});

elements.volume.addEventListener('input', (event) => {
  const volume = Number(event.target.value);
  elements.volumeFill.style.width = `${volume}%`;
  if (playerReady) player.setVolume(volume);
});

elements.captureButton.addEventListener('click', async () => {
  elements.captureButton.disabled = true;
  setStatus('画像を生成しています…');
  try {
    if (!window.htmlToImage?.toPng) throw new Error('画像生成ライブラリを読み込めませんでした');
    if (document.fonts?.ready) await document.fonts.ready;
    const dataUrl = await window.htmlToImage.toPng(elements.card, {
      pixelRatio: 4,
      cacheBust: true,
    });
    const link = document.createElement('a');
    link.download = 'spotify_player.png';
    link.href = dataUrl;
    link.click();
    setStatus('画像を保存しました', 'success');
  } catch (error) {
    setStatus(`画像の生成に失敗しました: ${error.message}`, 'error');
  } finally {
    elements.captureButton.disabled = false;
  }
});

elements.themeToggle.addEventListener('click', () => {
  setTheme(currentTheme === 'dark' ? 'light' : 'dark');
});

window.addEventListener('message', (event) => {
  if (isThemeMessage(event, location.origin)) {
    setTheme(event.data.theme, true, false);
  }
});

elements.cover.style.backgroundImage = `url("${DEFAULT_COVER}")`;
renderTime(staticCurrent, staticDuration);
setTheme(currentTheme, false, false);
