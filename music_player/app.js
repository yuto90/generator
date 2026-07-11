// ---- Constants ----
const DEFAULT_COVER = 'https://via.placeholder.com/300/1a1825/5b4fe0?text=Cover+Art';

// ---- State ----
let player = null;
let timeUpdater = null;
let isPlayerReady = false;
let pendingVideoId = null;
let isPlaying = false;
let uploadedImageSrc = DEFAULT_COVER;

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
        const percent = (currentTime / duration) * 100;
        document.getElementById('progress-slider').value = percent;
        document.getElementById('progress-fill').style.width = percent + '%';
        document.getElementById('progress-thumb').style.left = percent + '%';
      }
    }, 500);
  } else {
    clearInterval(timeUpdater);
    if (event.data === YT.PlayerState.ENDED) {
      isPlaying = false;
      document.getElementById('icon-play').style.display = 'flex';
      document.getElementById('icon-pause').style.display = 'none';
      document.getElementById('progress-slider').value = 0;
      document.getElementById('progress-fill').style.width = '0%';
      document.getElementById('progress-thumb').style.left = '0%';
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
  card.style.setProperty('--player-bg',    song.bgColor);
  card.style.setProperty('--player-point', song.pointColor);
  card.style.setProperty('--player-text',  song.textColor);

  document.getElementById('song-title').innerText     = title;
  document.getElementById('song-artist').innerText    = artist;
  document.getElementById('copyright-text').innerText = copyright;
  document.getElementById('cover-img').style.backgroundImage = `url('${song.imageSrc || DEFAULT_COVER}')`;

  if (youtubeId) {
    if (player && typeof player.cueVideoById === 'function') {
      player.cueVideoById(youtubeId);
      document.getElementById('icon-play').style.display  = 'flex';
      document.getElementById('icon-pause').style.display = 'none';
      isPlaying = false;
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
    link.download = 'my_custom_player.png';
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
    document.getElementById('icon-play').style.display  = 'flex';
    document.getElementById('icon-pause').style.display = 'none';
  } else {
    player.playVideo();
    document.getElementById('icon-play').style.display  = 'none';
    document.getElementById('icon-pause').style.display = 'flex';
  }
  isPlaying = !isPlaying;
});

// ---- 再生位置スライダー ----
document.getElementById('progress-slider').addEventListener('input', (e) => {
  const val = e.target.value;
  document.getElementById('progress-fill').style.width = val + '%';
  document.getElementById('progress-thumb').style.left = val + '%';
  if (player && typeof player.getDuration === 'function') {
    player.seekTo(player.getDuration() * (val / 100));
  }
});

// ---- 音量スライダー ----
document.getElementById('volume-slider').addEventListener('input', (e) => {
  const val = e.target.value;
  document.getElementById('volume-fill').style.width = val + '%';
  document.getElementById('volume-thumb').style.left = val + '%';
  if (player && typeof player.setVolume === 'function') player.setVolume(val);
});
