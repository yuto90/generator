import {
  readTheme,
  writeTheme,
  applyTheme,
  isThemeMessage,
  postTheme,
} from '../theme.js';

// ---- Constants ----
// 外部プレースホルダーサービスに依存しないよう、デフォルト画像はインライン SVG
const DEFAULT_BG = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="405" height="720" viewBox="0 0 405 720">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3b2450"/>
      <stop offset="0.5" stop-color="#50223a"/>
      <stop offset="1" stop-color="#1a1020"/>
    </linearGradient>
  </defs>
  <rect width="405" height="720" fill="url(#g)"/>
  <g fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="7" transform="translate(202 340) scale(3.4) translate(-12 -12)">
    <rect x="3" y="3" width="18" height="18" rx="5"/>
    <path d="M10 9.2v5.6c0 .5.55.8.97.53l4.3-2.8a.62.62 0 0 0 0-1.06l-4.3-2.8a.62.62 0 0 0-.97.53z" fill="rgba(255,255,255,0.4)" stroke="none"/>
  </g>
</svg>`);

const DEFAULT_AVATAR = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <rect width="96" height="96" fill="#4a3a55"/>
  <circle cx="48" cy="38" r="16" fill="rgba(255,255,255,0.55)"/>
  <path d="M16 96c0-18 14-28 32-28s32 10 32 28" fill="rgba(255,255,255,0.55)"/>
</svg>`);

// ---- State ----
let uploadedBgSrc = DEFAULT_BG;
let uploadedAvatarSrc = DEFAULT_AVATAR;

// ---- 画像ファイル選択 ----
function bindImageInput(inputId, onLoad) {
  document.getElementById(inputId).addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { onLoad(e.target.result); };
    reader.readAsDataURL(file);
  });
}

bindImageInput('in-bg-image', (src) => { uploadedBgSrc = src; });
bindImageInput('in-avatar-image', (src) => { uploadedAvatarSrc = src; });

function getFormState() {
  return {
    username: document.getElementById('in-username').value,
    caption:  document.getElementById('in-caption').value,
    audio:    document.getElementById('in-audio').value,
    likes:    document.getElementById('in-likes').value,
    comments: document.getElementById('in-comments').value,
    shares:   document.getElementById('in-shares').value,
  };
}

function applyPreview() {
  const reel = getFormState();
  const username = reel.username || 'username';

  document.getElementById('reel-username').innerText   = username;
  document.getElementById('reel-caption').innerText    = reel.caption || 'キャプションがここに入ります';
  document.getElementById('reel-audio-name').innerText = reel.audio || `${username}・オリジナル音源`;
  document.getElementById('like-count').innerText      = reel.likes || '1.2万';
  document.getElementById('comment-count').innerText   = reel.comments || '345';
  document.getElementById('share-count').innerText     = reel.shares || '67';

  document.getElementById('reel-bg').style.backgroundImage    = `url('${uploadedBgSrc}')`;
  document.getElementById('avatar-img').style.backgroundImage = `url('${uploadedAvatarSrc}')`;
  document.getElementById('rail-audio').style.backgroundImage = `url('${uploadedAvatarSrc}')`;
}

// ---- Theme ----
// リールカードは本物準拠の固定配色のため、テーマはフォーム側にのみ適用する
const themeToggle = document.querySelector('[data-theme-toggle]');
let currentTheme;

function setTheme(theme, persist = true, notifyParent = true) {
  currentTheme = applyTheme(document.documentElement, themeToggle, theme);
  if (persist) writeTheme(window.localStorage, currentTheme);
  if (notifyParent && window.parent !== window) {
    postTheme(window.parent, location.origin, currentTheme);
  }
}

currentTheme = applyTheme(document.documentElement, themeToggle, readTheme());

themeToggle.addEventListener('click', () => {
  setTheme(currentTheme === 'dark' ? 'light' : 'dark');
});

window.addEventListener('message', (event) => {
  if (isThemeMessage(event, location.origin)) {
    setTheme(event.data.theme, true, false);
  }
});

// ---- プレビュー更新 ----
document.getElementById('btn-update').addEventListener('click', applyPreview);

// ---- 画像キャプチャ ----
// html-to-image はブラウザ自身の描画(SVG foreignObject)を使うため、
// プレビューと同一の見た目で保存できる
document.getElementById('btn-capture').addEventListener('click', () => {
  const target = document.getElementById('reel-card');
  htmlToImage.toPng(target, { pixelRatio: 4 }).then((dataUrl) => {
    const link = document.createElement('a');
    link.download = 'instagram_reel.png';
    link.href = dataUrl;
    link.click();
  }).catch((e) => {
    alert('画像の生成に失敗しました: ' + e.message);
  });
});

// ---- 初期化 ----
applyPreview();
