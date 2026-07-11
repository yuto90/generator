import {
  readTheme,
  writeTheme,
  applyTheme,
  isThemeMessage,
  postTheme,
} from '../theme.js';

// ---- Constants ----
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

// ---- State ----
let player = null;
let timeUpdater = null;
let isPlayerReady = false;
let pendingVideoId = null;
let isPlaying = false;
let uploadedImageSrc = DEFAULT_COVER;

// ---- Color helpers ----
// Apple Music の Now Playing はアートワーク由来のグラデーション背景。
// ここでは BG カラーを基準に明暗 2 段のグラデーションを生成して近づける。
function shadeColor(hex, percent) {
  const n = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, (n >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt));
  const b = Math.min(255, Math.max(0, (n & 0xff) + amt));
  return `rgb(${r}, ${g}, ${b})`;
}

// ---- Time helpers ----
function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) return '-:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function updateTimeLabels(currentTime, duration) {
  document.getElementById('time-current').innerText = formatTime(currentTime);
  document.getElementById('time-remaining').innerText =
    duration > 0 ? `-${formatTime(duration - currentTime)}` : '-:--';
}

function setProgress(percent) {
  document.getElementById('progress-slider').value = percent;
  document.getElementById('progress-fill').style.width = percent + '%';
}

function setPlayingUI(playing) {
  isPlaying = playing;
  document.getElementById('icon-play').style.display = playing ? 'none' : 'block';
  document.getElementById('icon-pause').style.display = playing ? 'block' : 'none';
  document.getElementById('cover-img').classList.toggle('playing', playing);
}

// ---- YouTube IFrame API ----
window.onYouTubeIframeAPIReady = () => {
  if (pendingVideoId !== null) {
    _createYTPlayer(pendingVideoId);
    pendingVideoId = null;
  }
};

function _createYTPlayer(videoId) {
  isPlayerReady = false;
  player = new YT.Player('youtube-audio', {
    height: '1',
    width: '1',
    videoId,
    playerVars: { autoplay: 0, controls: 0, playsinline: 1 },
    events: {
      onReady: () => { isPlayerReady = true; },
      onStateChange: onPlayerStateChange,
    },
  });
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    timeUpdater = setInterval(() => {
      if (!player || typeof player.getDuration !== 'function') return;
      const duration = player.getDuration();
      const currentTime = player.getCurrentTime();
      if (duration > 0) {
        setProgress((currentTime / duration) * 100);
        updateTimeLabels(currentTime, duration);
      }
    }, 500);
  } else {
    clearInterval(timeUpdater);
    if (event.data === YT.PlayerState.ENDED) {
      setPlayingUI(false);
      setProgress(0);
      updateTimeLabels(0, player && typeof player.getDuration === 'function' ? player.getDuration() : 0);
    }
  }
}

// ---- YouTube IFrame API スクリプト読み込み ----
const ytScript = document.createElement('script');
ytScript.src = 'https://www.youtube.com/iframe_api';
document.head.appendChild(ytScript);

// ---- 画像ファイル選択 ----
document.getElementById('in-image').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => { uploadedImageSrc = e.target.result; };
  reader.readAsDataURL(file);
});

// YouTube の各種 URL 形式(watch/youtu.be/embed/shorts)や ID 直接入力から動画 ID を取り出す
function extractYouTubeId(input) {
  const trimmed = (input || '').trim();
  if (!trimmed) return '';
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (/(^|\.)youtu\.be$/.test(url.hostname)) {
      return url.pathname.split('/').filter(Boolean)[0] || '';
    }
    if (/(^|\.)youtube\.com$/.test(url.hostname)) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') {
        return parts[1] || '';
      }
      return url.searchParams.get('v') || '';
    }
  } catch (e) {
    // URL として解析できない入力への保険
  }
  const match = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : '';
}

function getFormState() {
  return {
    title:      document.getElementById('in-title').value,
    artist:     document.getElementById('in-artist').value,
    copyright:  document.getElementById('in-copyright').value,
    youtubeId:  extractYouTubeId(document.getElementById('in-youtube').value),
    imageSrc:   uploadedImageSrc === DEFAULT_COVER ? null : uploadedImageSrc,
    bgColor:    document.getElementById('in-bg-color').value,
    pointColor: document.getElementById('in-point-color').value,
    textColor:  document.getElementById('in-text-color').value,
  };
}

function applyPreview() {
  const song = getFormState();
  const title     = song.title     || '曲のタイトル';
  const artist    = song.artist    || 'アーティスト名';
  const copyright = song.copyright || 'ⓒ 出典';
  const youtubeId = song.youtubeId;

  const card = document.getElementById('player-card');
  card.style.background =
    `linear-gradient(165deg, ${shadeColor(song.bgColor, 16)} 0%, ${song.bgColor} 45%, ${shadeColor(song.bgColor, -28)} 100%)`;
  card.style.setProperty('--player-point', song.pointColor);
  card.style.setProperty('--player-text',  song.textColor);
  card.style.color = song.textColor;

  document.getElementById('song-title').innerText     = title;
  document.getElementById('song-artist').innerText    = artist;
  document.getElementById('copyright-text').innerText = copyright;
  document.getElementById('cover-img').style.backgroundImage = `url('${song.imageSrc || DEFAULT_COVER}')`;

  if (youtubeId) {
    if (player && typeof player.cueVideoById === 'function') {
      player.cueVideoById(youtubeId);
      setPlayingUI(false);
      setProgress(0);
      updateTimeLabels(0, 0);
    } else if (typeof YT !== 'undefined' && YT.Player) {
      _createYTPlayer(youtubeId);
    } else {
      pendingVideoId = youtubeId;
    }
  }
}

// ---- Theme ----
const themeToggle = document.querySelector('[data-theme-toggle]');
let currentTheme;

function setTheme(theme, persist = true, notifyParent = true) {
  currentTheme = applyTheme(document.documentElement, themeToggle, theme);
  const colors = THEME_COLORS[currentTheme];
  document.getElementById('in-bg-color').value = colors.bgColor;
  document.getElementById('in-point-color').value = colors.pointColor;
  document.getElementById('in-text-color').value = colors.textColor;
  applyPreview();

  if (persist) writeTheme(window.localStorage, currentTheme);
  if (notifyParent && window.parent !== window) {
    postTheme(window.parent, location.origin, currentTheme);
  }
}

currentTheme = applyTheme(document.documentElement, themeToggle, readTheme());
setTheme(currentTheme, false, false);

themeToggle.addEventListener('click', () => {
  setTheme(currentTheme === 'dark' ? 'light' : 'dark');
});

window.addEventListener('message', (event) => {
  if (isThemeMessage(event, location.origin)) {
    setTheme(event.data.theme, true, false);
  }
});

// ---- プレイヤープレビュー更新 ----
document.getElementById('btn-update').addEventListener('click', applyPreview);

// ---- 画像キャプチャ ----
// html-to-image はブラウザ自身の描画(SVG foreignObject)を使うため、
// プレビューと同一の見た目で保存できる
document.getElementById('btn-capture').addEventListener('click', () => {
  const target = document.getElementById('player-card');
  htmlToImage.toPng(target, { pixelRatio: 4 }).then((dataUrl) => {
    const link = document.createElement('a');
    link.download = 'apple_music_player.png';
    link.href = dataUrl;
    link.click();
  }).catch((e) => {
    alert('画像の生成に失敗しました: ' + e.message);
  });
});

// ---- 再生 / 一時停止 ----
document.getElementById('btn-play').addEventListener('click', () => {
  if (!player || !isPlayerReady) {
    return alert('まず[適用してプレビュー]を押して音楽を設定してください！');
  }
  if (isPlaying) {
    player.pauseVideo();
    setPlayingUI(false);
  } else {
    player.playVideo();
    setPlayingUI(true);
  }
});

// ---- 再生位置スライダー ----
document.getElementById('progress-slider').addEventListener('input', (e) => {
  const val = e.target.value;
  document.getElementById('progress-fill').style.width = val + '%';
  if (player && typeof player.getDuration === 'function') {
    const duration = player.getDuration();
    player.seekTo(duration * (val / 100));
    updateTimeLabels(duration * (val / 100), duration);
  }
});

// ---- 音量スライダー ----
document.getElementById('volume-slider').addEventListener('input', (e) => {
  const val = e.target.value;
  document.getElementById('volume-fill').style.width = val + '%';
  if (player && typeof player.setVolume === 'function') player.setVolume(val);
});

// ---- 初期化 ----
applyPreview();
