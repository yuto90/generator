// ---- Constants ----
const DEFAULT_COVER = 'https://via.placeholder.com/300/1a1825/5b4fe0?text=Cover+Art';

// ---- State ----
let player = null;
let timeUpdater = null;
let isPlayerReady = false;
let pendingVideoId = null;
let isPlaying = false;
let uploadedImageSrc = DEFAULT_COVER;

let playlist = [{
  id: Date.now(),
  title: '',
  artist: '',
  copyright: '',
  youtubeId: '',
  imageSrc: null,
  bgColor: '#1a1825',
  pointColor: '#7c6af0',
  textColor: '#e2e2ea',
}];
let activeIndex = 0;

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

// ---- Playlist helpers ----
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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

function saveCurrentToPlaylist() {
  Object.assign(playlist[activeIndex], getFormState());
}

function loadSongToForm(song) {
  document.getElementById('in-title').value       = song.title;
  document.getElementById('in-artist').value      = song.artist;
  document.getElementById('in-copyright').value   = song.copyright;
  document.getElementById('in-youtube').value     = song.youtubeId;
  document.getElementById('in-bg-color').value    = song.bgColor;
  document.getElementById('in-point-color').value = song.pointColor;
  document.getElementById('in-text-color').value  = song.textColor;
  document.getElementById('in-image').value = '';
  uploadedImageSrc = song.imageSrc || DEFAULT_COVER;
}

function applyPreview() {
  const song = playlist[activeIndex];
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

function renderPlaylist() {
  const list = document.getElementById('playlist-list');
  list.innerHTML = '';

  const musicIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;

  playlist.forEach((song, i) => {
    const item = document.createElement('div');
    item.className = 'playlist-item' + (i === activeIndex ? ' active' : '');

    const coverStyle = song.imageSrc
      ? `background-image: url('${song.imageSrc}');`
      : '';

    item.innerHTML = `
      <div class="playlist-cover" style="${coverStyle}">
        ${song.imageSrc ? '' : musicIcon}
      </div>
      <div class="playlist-info">
        <div class="playlist-title">${escapeHtml(song.title) || '（タイトル未設定）'}</div>
        <div class="playlist-artist">${escapeHtml(song.artist) || '（アーティスト未設定）'}</div>
      </div>
      <button class="playlist-delete" type="button" ${playlist.length === 1 ? 'disabled' : ''} aria-label="削除">×</button>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('playlist-delete')) return;
      if (i !== activeIndex) selectSong(i);
    });

    item.querySelector('.playlist-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSong(i);
    });

    list.appendChild(item);
  });
}

function selectSong(index) {
  saveCurrentToPlaylist();
  activeIndex = index;
  loadSongToForm(playlist[activeIndex]);
  applyPreview();
  renderPlaylist();
}

function addSong() {
  saveCurrentToPlaylist();
  playlist.push({
    id: Date.now(),
    title: '',
    artist: '',
    copyright: '',
    youtubeId: '',
    imageSrc: null,
    bgColor: '#1a1825',
    pointColor: '#7c6af0',
    textColor: '#e2e2ea',
  });
  activeIndex = playlist.length - 1;
  loadSongToForm(playlist[activeIndex]);
  applyPreview();
  renderPlaylist();
}

function deleteSong(index) {
  if (playlist.length === 1) return;
  playlist.splice(index, 1);
  if (activeIndex >= playlist.length) {
    activeIndex = playlist.length - 1;
  } else if (activeIndex > index) {
    activeIndex--;
  }
  loadSongToForm(playlist[activeIndex]);
  applyPreview();
  renderPlaylist();
}

// ---- プレイヤープレビュー更新 ----
document.getElementById('btn-update').addEventListener('click', () => {
  saveCurrentToPlaylist();
  applyPreview();
  renderPlaylist();
});

// ---- ＋ 追加ボタン ----
document.getElementById('btn-add-song').addEventListener('click', addSong);

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

// ---- 初期化 ----
renderPlaylist();
