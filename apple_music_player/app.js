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

function getFormState() {
  return {
    title:      document.getElementById('in-title').value,
    artist:     document.getElementById('in-artist').value,
    copyright:  document.getElementById('in-copyright').value,
    youtubeId:  document.getElementById('in-youtube').value.trim(),
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
  // html2canvas は color-mix 非対応のため、グラデーションは JS 側で組み立てる
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

// ---- プレイヤープレビュー更新 ----
document.getElementById('btn-update').addEventListener('click', applyPreview);

// ---- 画像キャプチャ ----
document.getElementById('btn-capture').addEventListener('click', () => {
  const target = document.getElementById('player-card');
  html2canvas(target, {
    backgroundColor: null,
    scale: 4,
    useCORS: true,
  }).then((canvas) => {
    const link = document.createElement('a');
    link.download = 'apple_music_player.png';
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
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
