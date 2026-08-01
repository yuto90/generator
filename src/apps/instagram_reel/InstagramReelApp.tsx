import { useRef, useState } from 'react';
import { useCapture } from '../../shared/capture/useCapture';
import ImageCropField from '../../shared/image-crop/ImageCropField';
import { createEditableImage, getEditableImageStyle, type EditableImage } from '../../shared/image-crop/image-crop';
import { ThemeToggle } from '../../shared/theme/ThemeToggle';
import './instagram-reel.css';

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

interface ReelContent {
  username: string;
  caption: string;
  audio: string;
  likes: string;
  comments: string;
  shares: string;
  bg: EditableImage;
  avatar: EditableImage;
}

const DEFAULT_CONTENT: ReelContent = {
  username: 'username',
  caption: 'キャプションがここに入ります',
  audio: 'username・オリジナル音源',
  likes: '1.2万',
  comments: '345',
  shares: '67',
  bg: createEditableImage(DEFAULT_BG),
  avatar: createEditableImage(DEFAULT_AVATAR),
};

export default function InstagramReelApp() {
  const [username, setUsername] = useState('');
  const [caption, setCaption] = useState('');
  const [audio, setAudio] = useState('');
  const [likes, setLikes] = useState('');
  const [comments, setComments] = useState('');
  const [shares, setShares] = useState('');
  const [bgImage, setBgImage] = useState(() => createEditableImage(DEFAULT_BG));
  const [avatarImage, setAvatarImage] = useState(() => createEditableImage(DEFAULT_AVATAR));

  const [applied, setApplied] = useState<ReelContent>(DEFAULT_CONTENT);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const { capture, capturing } = useCapture();

  function applyPreview() {
    const nextUsername = username || 'username';
    setApplied({
      username: nextUsername,
      caption: caption || 'キャプションがここに入ります',
      audio: audio || `${nextUsername}・オリジナル音源`,
      likes: likes || '1.2万',
      comments: comments || '345',
      shares: shares || '67',
      bg: bgImage,
      avatar: avatarImage,
    });
  }

  function handleCapture() {
    capture(cardRef.current, 'instagram_reel.png').catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      alert(message);
    });
  }

  return (
    <div className="app-instagram">
      <div className="maker-layout relative flex min-h-screen w-full max-w-[1500px] mx-auto items-center justify-center pr-[340px] max-md:flex-col max-md:px-4 max-md:py-6 max-md:gap-4 max-md:min-h-0 max-md:justify-start">

        {/* ---- Center: Instagram Reel preview ---- */}
        <div id="capture-area" className="flex w-full justify-center max-md:w-auto">
          <div className="reel-card" id="reel-card" ref={cardRef}>

            <div className="reel-bg" id="reel-bg" style={getEditableImageStyle(applied.bg)} />
            <div className="reel-scrim-top" />
            <div className="reel-scrim-bottom" />

            {/* Top bar */}
            <div className="reel-topbar">
              <span className="reel-heading">リール</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14.5 4h-9A2.5 2.5 0 0 0 3 6.5v11A2.5 2.5 0 0 0 5.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-11A2.5 2.5 0 0 0 14.5 4z" />
                <path d="M17 10l4-2.5v9L17 14" />
              </svg>
            </div>

            {/* Right action rail */}
            <div className="reel-rail">
              <div className="rail-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 20.3S3.5 15.4 3.5 9.6a4.6 4.6 0 0 1 8.5-2.5A4.6 4.6 0 0 1 20.5 9.6c0 5.8-8.5 10.7-8.5 10.7z" />
                </svg>
                <span className="rail-count" id="like-count">{applied.likes}</span>
              </div>
              <div className="rail-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-2.9-.38-4.1-1.05L3 20l1.1-5.2A8.5 8.5 0 1 1 21 11.5z" />
                </svg>
                <span className="rail-count" id="comment-count">{applied.comments}</span>
              </div>
              <div className="rail-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 3L10 13.2" />
                  <path d="M21 3l-7 18-4-7.8L2 9.5 21 3z" />
                </svg>
                <span className="rail-count" id="share-count">{applied.shares}</span>
              </div>
              <div className="rail-item">
                <svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                  <circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" />
                </svg>
              </div>
              <div className="rail-audio" id="rail-audio" style={getEditableImageStyle(applied.avatar)} />
            </div>

            {/* Bottom info */}
            <div className="reel-bottom">
              <div className="reel-user">
                <div className="reel-avatar" id="avatar-img" style={getEditableImageStyle(applied.avatar)} />
                <span className="reel-username" id="reel-username">{applied.username}</span>
              </div>
              <div className="reel-caption" id="reel-caption">{applied.caption}</div>
              <div className="reel-audio-row">
                <svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                </svg>
                <span className="reel-audio-name" id="reel-audio-name">{applied.audio}</span>
              </div>
            </div>

          </div>
        </div>

        {/* ---- Right panel (controls) ---- */}
        <div className="glass-panel side-panel input-section absolute inset-y-0 right-0 flex flex-col w-[320px] p-6 overflow-y-auto max-md:static max-md:w-full max-md:max-w-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-br from-[#833ab4] to-[#fd1d1d]" />
              <h2 className="panel-title text-sm font-semibold tracking-wide uppercase">Instagram Reel</h2>
            </div>
            <ThemeToggle className="theme-toggle" />
          </div>

          <div className="flex flex-col gap-4">
            <ImageCropField
              id="in-bg-image"
              label="Background Image"
              value={bgImage}
              targetAspect={9 / 16}
              onChange={setBgImage}
              helpText="範囲を調整して9:16の背景へ反映できます"
            />
            <ImageCropField
              id="in-avatar-image"
              label="Icon Image"
              value={avatarImage}
              targetAspect={1}
              onChange={setAvatarImage}
            />
            <div>
              <label className="field-label" htmlFor="in-username">Username</label>
              <input className="field-input" type="text" id="in-username" placeholder="ユーザー名" value={username} onChange={e => setUsername(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="in-caption">Caption</label>
              <textarea className="field-input" id="in-caption" rows={2} placeholder="キャプション" value={caption} onChange={e => setCaption(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="in-audio">Audio</label>
              <input className="field-input" type="text" id="in-audio" placeholder="例: ユーザー名・オリジナル音源" value={audio} onChange={e => setAudio(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="field-label" htmlFor="in-likes">Likes</label>
                <input className="field-input" type="text" id="in-likes" placeholder="1.2万" value={likes} onChange={e => setLikes(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="field-label" htmlFor="in-comments">Comments</label>
                <input className="field-input" type="text" id="in-comments" placeholder="345" value={comments} onChange={e => setComments(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="field-label" htmlFor="in-shares">Shares</label>
                <input className="field-input" type="text" id="in-shares" placeholder="67" value={shares} onChange={e => setShares(e.target.value)} />
              </div>
            </div>
          </div>

          <hr className="divider" />

          <div className="flex flex-col gap-2.5">
            <button className="btn-primary btn-apply" id="btn-update" type="button" onClick={applyPreview}>適用してプレビュー</button>
            <button className="btn-primary btn-save" id="btn-capture" type="button" onClick={handleCapture} disabled={capturing}>
              {capturing ? '画像を生成中…' : '画像として保存'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
