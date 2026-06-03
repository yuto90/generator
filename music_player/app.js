// ---- State ----
let player = null;
let timeUpdater = null;
let isPlayerReady = false;
let pendingVideoId = null;
let isPlaying = false;
let uploadedImageSrc = 'https://via.placeholder.com/300/e0dcd3/8c7f76?text=Image+Here';

// ---- YouTube IFrame API ----
// グローバルスコープへの公開が必要（YouTube IFrame API の仕様）
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

// ---- プレイヤープレビュー更新 ----
document.getElementById('btn-update').addEventListener('click', () => {
    const title     = document.getElementById('in-title').value     || '曲のタイトル';
    const artist    = document.getElementById('in-artist').value    || 'アーティスト名';
    const copyright = document.getElementById('in-copyright').value || 'ⓒ 出典';
    const youtubeId = document.getElementById('in-youtube').value.trim() || 'w2-uvGZCe3g';

    const card = document.getElementById('player-card');
    card.style.setProperty('--player-bg',    document.getElementById('in-bg-color').value);
    card.style.setProperty('--player-point', document.getElementById('in-point-color').value);
    card.style.setProperty('--player-text',  document.getElementById('in-text-color').value);

    document.getElementById('song-title').innerText    = title;
    document.getElementById('song-artist').innerText   = artist;
    document.getElementById('copyright-text').innerText = copyright;
    document.getElementById('cover-img').style.backgroundImage = `url('${uploadedImageSrc}')`;

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
});

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
        return alert('まず[適用する]を押して音楽を設定してください！');
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
    document.getElementById('progress-fill').style.width  = val + '%';
    document.getElementById('progress-thumb').style.left  = val + '%';
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
