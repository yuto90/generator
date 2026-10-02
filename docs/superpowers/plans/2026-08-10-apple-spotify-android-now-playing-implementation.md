# Apple Music・Spotify Android Now Playing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apple MusicとSpotifyの保存対象を最新Android Now Playingの情報階層へ更新し、Pixel 10 Pro XLの縦長キャンバスを大きな未使用帯なく使う。

**Architecture:** 各アプリの既存状態管理・画像編集・YouTube再生・端末プレビュー・保存経路は維持し、保存対象のJSXだけを意味単位のゾーンへ再編する。各カードを`container-type: size`の全面プレーヤーとし、アートワーク領域へ余剰高を配り、操作群を下端へ固定する。アプリ固有CSSだけを変更し、共有端末プレビューとキャプチャ処理は変更しない。

**Tech Stack:** React 19、TypeScript 5.8、CSS Container Queries、Vitest、Testing Library、SnapDOM、Vite

## Global Constraints

- 対象はApple MusicとSpotifyのみとし、YouTube MusicとInstagram Reelを変更しない。
- Pixel 10 Pro XLは論理`448×997`、保存PNGは物理`1344×2992`を維持する。
- OSステータスバー、パンチホール、端末枠、ホームインジケーターを描画しない。
- 既存の入力、画像トリミング、YouTube再生、テーマ、端末サイズ、PNG保存を維持する。
- 保存画像へ編集パネルと端末ツールバーを含めない。
- UIテキスト、アクセシブル名、コードコメントは日本語にする。
- 本番コード変更前に対応する失敗テストを確認する。

---

### Task 1: Android Now Playing構造の回帰テスト

**Files:**
- Modify: `src/apps/apps.test.tsx`
- Test: `src/apps/apps.test.tsx`

**Interfaces:**
- Consumes: `AppleMusicPlayerApp`、`SpotifyPlayerApp`の実DOM
- Produces: Android固有の操作名と全面表示ゾーンを固定するVitest契約

- [ ] **Step 1: CSS fixtureとApple Musicの失敗テストを追加する**

`apps.test.tsx`のCSS fixtureへ次を追加する。

```ts
const appleMusicCss = readFileSync('src/apps/apple_music_player/apple-music-player.css', 'utf8');
const spotifyCss = readFileSync('src/apps/spotify_player/spotify-player.css', 'utf8');
```

`AppleMusicPlayerApp` describeへ次を追加する。

```ts
test('Android版Now Playingの全面表示と操作を描画する', () => {
  renderApp(<AppleMusicPlayerApp />);

  expect(document.querySelector('.am-artwork-stage')).toBeInTheDocument();
  expect(document.querySelector('.am-player-panel')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'お気に入り' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'その他' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Chromecast' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '次に再生' })).toBeInTheDocument();
  expect(screen.getByLabelText('音量')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'AirPlay' })).not.toBeInTheDocument();
  expect(appleMusicCss).toContain('.am-card {');
  expect(appleMusicCss).toMatch(/\.device-canvas__content > \.am-card\s*\{[^}]*border-radius:\s*0/s);
});
```

- [ ] **Step 2: Apple Musicテストが期待した理由で失敗することを確認する**

Run: `npm run test:unit -- src/apps/apps.test.tsx -t "Android版Now Playing"`

Expected: `.am-artwork-stage`または`お気に入り`が存在せずFAILする。

- [ ] **Step 3: Spotifyの失敗テストを追加する**

`SpotifyPlayerApp` describeへ次を追加する。

```ts
test('Android版Now Playingの全面表示と操作を描画する', () => {
  renderApp(<SpotifyPlayerApp />);

  expect(document.querySelector('.spotify-backdrop')).toBeInTheDocument();
  expect(document.querySelector('.spotify-artwork-stage')).toBeInTheDocument();
  expect(screen.getByText('プレイリストから再生中')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'その他' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'ライブラリに保存' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '再生デバイス' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'キュー' })).toBeInTheDocument();
  expect(screen.getByLabelText('音量')).toBeInTheDocument();
  expect(spotifyCss).toMatch(/\.device-canvas__content > \.spotify-card\s*\{[^}]*border-radius:\s*0/s);
});
```

- [ ] **Step 4: Spotifyテストが期待した理由で失敗することを確認する**

Run: `npm run test:unit -- src/apps/apps.test.tsx -t "Android版Now Playing"`

Expected: `.spotify-backdrop`または`プレイリストから再生中`が存在せずFAILする。Apple Music側も未実装のため同時にFAILしてよい。

- [ ] **Step 5: テストだけをコミット候補として確認する**

Run: `git diff --check -- src/apps/apps.test.tsx`

Expected: exit 0。

### Task 2: Apple Music Android全面プレーヤー

**Files:**
- Modify: `src/apps/apple_music_player/AppleMusicPlayerApp.tsx`
- Modify: `src/apps/apple_music_player/apple-music-player.css`
- Test: `src/apps/apps.test.tsx`

**Interfaces:**
- Consumes: `applied.cover`、`applied.title`、`applied.artist`、`applied.copyright`、`playing`、`progress`、`times`、`volume`
- Produces: `.am-artwork-stage`、`.am-player-panel`、Android固有の操作button、編集パネル内の`aria-label="音量"`

- [ ] **Step 1: Apple MusicのJSXを3ゾーンへ再編する**

`am-card`直下を次の構造にする。

```tsx
<div className={playing ? 'am-artwork-stage playing' : 'am-artwork-stage'} style={getEditableImageStyle(applied.cover)} />
<div className="am-artwork-shade" />
<div className="am-screen-content">
  <div className="am-grabber" />
  <section className="am-player-panel" aria-label="再生中の曲">
    <div className="am-track-row">...</div>
    <div className="am-progress-group">...</div>
    <div className="am-transport">...</div>
    <div className="am-bottom-icons">...</div>
    <div className="am-copyright" id="copyright-text">{applied.copyright}</div>
  </section>
</div>
```

曲情報の右側へ`aria-label="お気に入り"`の星形buttonと`aria-label="その他"`の縦3点buttonを置く。再生位置の時刻中央へ`Dolby Atmos`を表示する。下部の`AirPlay` buttonは`aria-label="Chromecast"`とキャスト形SVGへ置換する。

- [ ] **Step 2: 音量操作を編集パネルへ移す**

保存対象の音量行を削除し、編集パネルのYouTube URL入力後へ次の操作を追加する。

```tsx
<div>
  <label className="field-label" htmlFor="in-volume">音量</label>
  <input
    className="editor-range"
    id="in-volume"
    type="range"
    min="0"
    max="100"
    value={volume}
    onChange={handleVolumeInput}
    aria-label="音量"
  />
</div>
```

- [ ] **Step 3: Apple Musicの全面レイアウトCSSを実装する**

`.am-card`を`position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: 0;`とし、外側shadowを削除する。`.am-artwork-stage`は`position: absolute; inset: 0 0 auto; height: clamp(52%, 60cqh, 66%); background-size: cover;`、`.am-artwork-shade`は上部の弱い暗幕と下部の濃いグラデーションを重ねる。

`.am-screen-content`を`position: relative; z-index: 1; display: flex; flex-direction: column; height: 100%;`、`.am-player-panel`を`margin-top: auto; width: min(100%, 620px); margin-inline: auto;`にする。間隔と文字・ボタン寸法は`clamp()`とcontainer queryで`320×568`から`1024×1366`へ対応させる。

- [ ] **Step 4: Apple Music対象テストを成功させる**

Run: `npm run test:unit -- src/apps/apps.test.tsx -t "AppleMusicPlayerApp|Android版Now Playing"`

Expected: Apple Musicの既存テストと新規テストがPASSする。Spotifyの未実装テストは対象名の共有によりFAILする場合、`-t "AppleMusicPlayerApp"`でApple Musicだけを確認する。

- [ ] **Step 5: Apple Music変更の型と差分を確認する**

Run: `npm run build`

Expected: `tsc --noEmit`とVite buildがexit 0。

### Task 3: Spotify Android全面プレーヤー

**Files:**
- Modify: `src/apps/spotify_player/SpotifyPlayerApp.tsx`
- Modify: `src/apps/spotify_player/spotify-player.css`
- Test: `src/apps/apps.test.tsx`

**Interfaces:**
- Consumes: `applied.cover`、`applied.title`、`applied.artist`、`time`、`progress`、`playing`、`volume`
- Produces: `.spotify-backdrop`、`.spotify-artwork-stage`、`.spotify-controls`、button化したSpotify Connectとキュー、編集パネル内の`aria-label="音量"`

- [ ] **Step 1: Spotifyの背景・ヘッダー・本体・フッターを再編する**

`spotify-card`直下を次の構造にする。

```tsx
<div className="spotify-backdrop" style={getEditableImageStyle(applied.cover)} />
<div className="spotify-backdrop-shade" />
<header className="card-topbar">...</header>
<main className="spotify-player-body">
  <div className="spotify-artwork-stage">
    <div className="artwork" id="cover-art" style={getEditableImageStyle(applied.cover)} />
  </div>
  <section className="spotify-controls" aria-label="再生中の曲">...</section>
</main>
<footer className="device-row">...</footer>
```

ヘッダー中央は`プレイリストから再生中`と`お気に入りの曲`の2行にし、右側を縦3点buttonにする。お気に入りheartは円囲みプラスの`aria-label="ライブラリに保存"`へ置換する。フッターは`aria-label="再生デバイス"`と`aria-label="キュー"`の2 buttonにする。

- [ ] **Step 2: 音量操作を編集パネルへ移す**

保存対象の`.volume-row`を削除し、編集フォームのYouTube URL入力後へ次を追加する。

```tsx
<div>
  <label className="field-label" htmlFor="in-volume">音量</label>
  <input
    className="editor-range"
    id="in-volume"
    type="range"
    min="0"
    max="100"
    value={volume}
    onChange={handleVolumeInput}
    aria-label="音量"
  />
</div>
```

- [ ] **Step 3: Spotifyの全面レイアウトCSSを実装する**

`.spotify-card`を`position: relative; display: flex; flex-direction: column; width: 100%; height: 100%; border-radius: 0; overflow: hidden;`にする。`.spotify-backdrop`へ`position: absolute; inset: -8%; filter: blur(48px) saturate(.85) brightness(.55); transform: scale(1.2); opacity: .58;`を与え、`.spotify-backdrop-shade`で暗色グラデーションを重ねる。

`.spotify-player-body`を`display: grid; grid-template-rows: minmax(0, 1fr) auto; flex: 1; min-height: 0;`、`.spotify-artwork-stage`を中央配置する。`.artwork`は`min(100cqw - 44px, 100cqh - control area)`で正方形を維持する。`.spotify-controls`と`.device-row`へ最大幅を設け、`.device-row`を下端へ置く。

- [ ] **Step 4: Spotify対象テストを成功させる**

Run: `npm run test:unit -- src/apps/apps.test.tsx -t "SpotifyPlayerApp|Android版Now Playing"`

Expected: Spotifyの既存テストと新規テストがPASSする。

- [ ] **Step 5: 2アプリのテストをまとめて確認する**

Run: `npm run test:unit -- src/apps/apps.test.tsx`

Expected: `apps.test.tsx`の全テストがPASSする。

### Task 4: 全サイズ・高解像度保存・回帰検証

**Files:**
- Modify when required by observed regression only: `src/apps/apple_music_player/AppleMusicPlayerApp.tsx`
- Modify when required by observed regression only: `src/apps/apple_music_player/apple-music-player.css`
- Modify when required by observed regression only: `src/apps/spotify_player/SpotifyPlayerApp.tsx`
- Modify when required by observed regression only: `src/apps/spotify_player/spotify-player.css`
- Test: `src/apps/apps.test.tsx`

**Interfaces:**
- Consumes: Vite開発サーバー、Chrome headless/CDP、DeviceToolbarの端末プリセット
- Produces: 代表サイズのgeometry証拠、Pixel 10 Pro XLの実PNG、全テスト・build結果

- [ ] **Step 1: 全自動テストを実行する**

Run: `npm test`

Expected: Vitestと`node --test tests/*.test.js`がすべてPASSする。

- [ ] **Step 2: 本番ビルドと差分検査を実行する**

Run: `npm run build`

Expected: exit 0。

Run: `git diff --check origin/main...HEAD`

Expected: exit 0。

- [ ] **Step 3: 代表サイズのブラウザgeometryを確認する**

Viteを起動し、Apple MusicとSpotifyを`320×568`、`375×667`、`448×997`、`768×1024`で表示する。各サイズでカードの`clientWidth/clientHeight`と`scrollWidth/scrollHeight`が一致し、すべてのbuttonのbounding boxがカード内にあることをCDPで記録する。

- [ ] **Step 4: Pixel 10 Pro XLの実PNGを確認する**

両アプリでPixel 10 Pro XLを選択して保存し、PNG metadataが`1344×2992 RGBA`であることを確認する。Apple Musicは上端のアートワークから下端の出典まで、Spotifyは上端ヘッダーから下端の接続・キューまでが表示され、四辺へ背景が届くことを目視する。

- [ ] **Step 5: 最終差分を限定してコミットする**

```bash
git add \
  docs/superpowers/specs/2026-08-10-apple-spotify-android-now-playing-design.md \
  docs/superpowers/plans/2026-08-10-apple-spotify-android-now-playing-implementation.md \
  src/apps/apps.test.tsx \
  src/apps/apple_music_player/AppleMusicPlayerApp.tsx \
  src/apps/apple_music_player/apple-music-player.css \
  src/apps/spotify_player/SpotifyPlayerApp.tsx \
  src/apps/spotify_player/spotify-player.css
git commit -m "feat: refresh Android music player layouts"
```

- [ ] **Step 6: ローカルレビューとPR更新へ引き渡す**

`final_reviewer`で`origin/main...HEAD`をレビューし、P0〜P2がない状態にする。既存PR #41へpushし、PR本文・既存完了コメントを最新HEADの検証結果へ更新する。PR全体の`@codex review`は既に1回消費済みのため再依頼しない。Vercel系checksを含むrequired checksが最新HEADで成功するまで確認する。

## Self-Review

- Spec coverage: Apple Music、Spotify、Android固有表現、全面表示、音量機能維持、代表サイズ、高解像度PNG、PR再開条件をTasks 1〜4へ割り当てた。
- Placeholder scan: 未確定事項や後回しの指示はなく、各実装・検証手順を具体化した。
- Type consistency: 既存の`handleVolumeInput`、`getEditableImageStyle`、`applied`、`progress`、`time/times`をそのまま使用し、新しい共有APIは追加しない。
