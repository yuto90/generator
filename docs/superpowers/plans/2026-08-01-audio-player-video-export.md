# 音声プレーヤー動画出力 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 4つの音声プレーヤーで、ローカル音源と再生位置を同期したカード範囲のMP4をブラウザ内生成・保存できるようにする。

**Architecture:** `src/shared/video/` にタイムライン計算、ローカル音源、コーデック判定、Mediabunny出力を集約する。各アプリはカードを表示専用コンポーネントへ分離し、画面プレビューと画面外のフレーム生成で同じカードを使う。既存のYouTubeプレビューとPNG保存は保持する。

**Tech Stack:** React 19、TypeScript、Vitest、html-to-image、Mediabunny 1.52.2、Web Audio API、WebCodecs。

## Global Constraints

- 動画出力にはローカル音源を必須とし、YouTube URLはプレビュー専用にする。
- 出力時間は `min(30秒, 音源時間 - 開始位置)` とし、残り1秒以上なら曲末で短縮した動画を許可する。
- 出力はカード範囲、幅1080px、30fps、H.264/AACのMP4に固定する。
- 正式対応ブラウザはChromeとSafariで、H.264/AACのエンコード可否を実行時判定する。
- YouTube音声のダウンロード、分離、再合成、WebMフォールバック、サーバー処理は行わない。
- UIテキスト、コードコメント、説明は日本語にする。
- 既存の画像保存、YouTubeプレビュー、ハッシュルート、各アプリの見た目を依頼範囲外で変更しない。
- 変更後は `npm test` と `npm run build` を実行する。

## File Map

- Create `src/shared/video/video-types.ts`: 共通型、エラーコード、フレーム状態。
- Create `src/shared/video/video-timeline.ts`: `m:ss`解析、動画範囲、フレーム時刻、偶数高さ計算。
- Create `src/shared/video/video-timeline.test.ts`: タイムライン境界テスト。
- Create `src/shared/video/useLocalAudio.ts`: ローカル音源Object URL、HTMLAudioElement、音源状態、再生・シーク。
- Create `src/shared/video/useLocalAudio.test.ts`: URL解放、メタデータ、音源優先の状態テスト。
- `useLocalAudio` は選択ファイルの `AudioBuffer` デコードも完了させ、出力側へ同じデコード結果を渡す。
- Create `src/shared/video/video-capabilities.ts`: H.264/AAC対応判定。
- Create `src/shared/video/video-exporter.ts`: 音声切り出し、画面外カードのフレーム取得、Mediabunny MP4出力、キャンセル。
- Create `src/shared/video/video-exporter.test.ts`: 出力境界、進捗、失敗、キャンセルのテスト。
- Create `src/shared/video/VideoExportPanel.tsx`: 画像／動画タブ、動画フォーム、状態・エラー・進捗表示。
- Create `src/shared/video/video-export-panel.css`: 共通パネルのスコープCSS。
- Modify `package.json`, `package-lock.json`: `mediabunny` 1.52.2を追加。
- Modify the 4 `src/apps/*/*App.tsx` files and their CSS: card分離、ローカル音源、VideoExportPanel接続。
- Modify `src/apps/apps.test.tsx`: 4アプリのタブと既存PNG保存の回帰テスト。

### Task 1: タイムラインと音源モデルをTDDで作る

**Files:**
- Create: `src/shared/video/video-types.ts`
- Create: `src/shared/video/video-timeline.ts`
- Create: `src/shared/video/video-timeline.test.ts`
- Create: `src/shared/video/useLocalAudio.ts`
- Create: `src/shared/video/useLocalAudio.test.ts`

**Interfaces:**

```ts
export interface VideoClipRange {
  start: number;
  end: number;
  duration: number;
}

export interface PlayerFrameState {
  currentTime: number;
  duration: number;
  progress: number;
  playing: boolean;
  volume: number;
}

export interface LocalAudioState {
  file: File | null;
  buffer: AudioBuffer | null;
  duration: number;
  currentTime: number;
  playing: boolean;
  volume: number;
  error: string;
}

export function parseVideoStartTime(value: string): number | null;
export function calculateVideoClipRange(audioDuration: number, start: number): VideoClipRange | null;
export function getVideoFrameTime(range: VideoClipRange, frameIndex: number, fps?: number): number;
export function calculateVideoOutputHeight(cssWidth: number, cssHeight: number, outputWidth?: number): number;
```

- [ ] **Step 1: Write failing tests for `parseVideoStartTime` and `calculateVideoClipRange`**

  Cover `0:00`, `1:20`, whitespace, malformed strings, negative values, audio duration shorter than 1 second, start at end, 30-second cap, and curve-to-end output.

- [ ] **Step 2: Run the focused test and verify the expected missing-module failure**

  Run `npm test -- src/shared/video/video-timeline.test.ts`.

- [ ] **Step 3: Implement the pure timeline functions**

  Reject non-finite values, enforce `duration >= 1`, cap at 30 seconds, and clamp frame times to `range.end`.

- [ ] **Step 4: Add `useLocalAudio` tests before implementation**

  Test selecting a file creates one Object URL, metadata updates duration, replacing/unmounting revokes URLs, and playback commands use local audio when selected.

- [ ] **Step 5: Implement `useLocalAudio`**

  Use an `HTMLAudioElement`, `URL.createObjectURL`, `loadedmetadata`, `timeupdate`, `ended`, and cleanup. Decode the same selected file with `AudioContext.decodeAudioData` and expose `{ file, buffer, duration, currentTime, playing, volume, error, selectFile, play, pause, seek, setVolume, clear }`.

- [ ] **Step 6: Run focused tests and commit**

  Run `npm test -- src/shared/video/video-timeline.test.ts src/shared/video/useLocalAudio.test.ts`.
  Commit with `feat: add video timeline and local audio primitives`.

### Task 2: コーデック判定とMediabunny MP4出力をTDDで作る

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `src/shared/video/video-capabilities.ts`
- Create: `src/shared/video/video-exporter.ts`
- Create: `src/shared/video/video-exporter.test.ts`

**Interfaces:**

```ts
export interface VideoCapabilityState {
  supported: boolean;
  video: boolean;
  audio: boolean;
  message: string;
}

export interface VideoExportOptions {
  card: HTMLElement;
  range: VideoClipRange;
  audio: AudioBuffer;
  volume: number;
  onFrame: (state: PlayerFrameState) => Promise<void>;
  onProgress?: (phase: VideoExportPhase, progress: number) => void;
  signal?: AbortSignal;
}

export async function detectVideoCapabilities(width: number, height: number): Promise<VideoCapabilityState>;
export function trimAndNormalizeAudio(audio: AudioBuffer, range: VideoClipRange, volume: number): AudioBuffer;
export async function exportPlayerVideo(options: VideoExportOptions): Promise<Blob>;
```

- [ ] **Step 1: Add Mediabunny and write failing capability/export tests**

  Mock only browser encoder and Mediabunny boundaries. Assert the capability result reports each missing codec, and the exporter rejects an aborted signal before creating a download.

- [ ] **Step 2: Run the focused test and confirm it fails because the modules do not exist**

  Run `npm test -- src/shared/video/video-exporter.test.ts`.

- [ ] **Step 3: Implement capability detection**

  Call `canEncodeVideo('avc', { width, height, bitrate })` and `canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: 48000, bitrate })`. Return a Japanese message that identifies the missing encoder.

- [ ] **Step 4: Implement deterministic frame and audio output**

  Implement `trimAndNormalizeAudio` with an `OfflineAudioContext` at 48kHz and at most two channels, then create an MP4 `Output` with `Mp4OutputFormat` and `BufferTarget`, add `CanvasSource` and `AudioBufferSource`, add 30fps frames with awaited backpressure, honor cancellation, finalize, and return a Blob. The exporter receives the already decoded `AudioBuffer` from `useLocalAudio`; it does not decode the file a second time.

- [ ] **Step 5: Verify focused tests and commit**

  Run `npm test -- src/shared/video/video-exporter.test.ts`.
  Commit with `feat: add browser MP4 video exporter`.

### Task 3: 共通動画パネルを作る

**Files:**
- Create: `src/shared/video/VideoExportPanel.tsx`
- Create: `src/shared/video/video-export-panel.css`
- Create: `src/shared/video/VideoExportPanel.test.tsx`

**Interfaces:**

```ts
interface VideoExportPanelProps {
  appId: string;
  exportCardRef: React.RefObject<HTMLElement | null>;
  audio: LocalAudioState;
  onAudioFileChange: (file: File | null) => void;
  frameState: PlayerFrameState;
  duration: number;
  currentTime: number;
  onSeek: (seconds: number) => void;
  onFrame: (state: PlayerFrameState) => Promise<void>;
  volume: number;
  onVolumeChange: (volume: number) => void;
}
```

- [ ] **Step 1: Write failing component tests**

  Assert the image/video tabs, local audio label, start time field, output-range text, YouTube exclusion copy, disabled save state, capability error, progress phase, cancel button, retry button, and existing image tab callback.

- [ ] **Step 2: Run the test to verify it fails**

  Run `npm test -- src/shared/video/VideoExportPanel.test.tsx`.

- [ ] **Step 3: Implement the panel and state machine**

  Keep the image tab as the initial tab, render the audio file input through `onAudioFileChange`, synchronize the time input with `onSeek`, compute range from `audio.duration`, require `audio.buffer` before saving, call `exportPlayerVideo` with `exportCardRef.current`, trigger `<a download>`, show Japanese errors and retry, and disable all actions while generating.

- [ ] **Step 4: Verify and commit**

  Run `npm test -- src/shared/video/VideoExportPanel.test.tsx`.
  Commit with `feat: add shared video export panel`.

### Task 4: Music Playerへ統合する

**Files:**
- Modify: `src/apps/music_player/MusicPlayerApp.tsx`
- Modify: `src/apps/music_player/music-player.css`
- Modify: `src/apps/apps.test.tsx`

- [ ] **Step 1: Add a failing integration test**

  Assert the Music Player renders the video tab, local audio input, YouTube exclusion copy, and still exposes `画像として保存`.

- [ ] **Step 2: Extract a prop-driven `MusicPlayerCard`**

  Move only card markup and card-specific style values into a display component; retain form and existing YouTube behavior in the app.

- [ ] **Step 3: Connect local audio, frame state, and `VideoExportPanel`**

  Use local audio when present, stop YouTube before local playback, pass the same `PlayerFrameState` to the visible and hidden cards, and keep the PNG capture ref on the visible card.

- [ ] **Step 4: Run Music Player tests and commit**

  Run `npm test -- src/apps/apps.test.tsx`.
  Commit with `feat: add video export to music player`.

### Task 5: Apple MusicとYouTube Musicへ統合する

**Files:**
- Modify: `src/apps/apple_music_player/AppleMusicPlayerApp.tsx`
- Modify: `src/apps/apple_music_player/apple-music-player.css`
- Modify: `src/apps/youtube_music_player/YoutubeMusicPlayerApp.tsx`
- Modify: `src/apps/youtube_music_player/youtube-music-player.css`
- Modify: `src/apps/apps.test.tsx`

- [ ] **Step 1: Add failing integration assertions**

  Assert both apps show the shared video tab and preserve their current color, artwork, time, volume, PNG, and YouTube preview controls.

- [ ] **Step 2: Extract `AppleMusicPlayerCard` and `YoutubeMusicPlayerCard`**

  Preserve each app's existing CSS class names and playing artwork behavior while accepting `PlayerFrameState` props.

- [ ] **Step 3: Connect the panel and local audio precedence**

  Use the shared panel and exporter; local audio controls preview when selected, while YouTube remains available only when no local source is active.

- [ ] **Step 4: Run focused tests and commit**

  Run `npm test -- src/apps/apps.test.tsx`.
  Commit with `feat: add video export to apple and youtube music players`.

### Task 6: Spotify Styleへ統合する

**Files:**
- Modify: `src/apps/spotify_player/SpotifyPlayerApp.tsx`
- Modify: `src/apps/spotify_player/spotify-player.css`
- Modify: `src/apps/apps.test.tsx`

- [ ] **Step 1: Add failing Spotify video-tab assertions**

  Cover form validation, static position/duration mode, local audio selection, and preservation of `画像として保存`.

- [ ] **Step 2: Extract a prop-driven `SpotifyPlayerCard`**

  Keep its existing static-time fallback when no YouTube/local source is active, but use the local audio duration and playhead for video mode.

- [ ] **Step 3: Connect shared video export and status messages**

  Keep Spotify's existing validation and status area; route video capability, export progress, retry, and YouTube exclusion through the shared panel.

- [ ] **Step 4: Run focused tests and commit**

  Run `npm test -- src/apps/apps.test.tsx`.
  Commit with `feat: add video export to spotify player`.

### Task 7: 全体検証と配布準備

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-08-01-audio-player-video-export-design.md` only if implementation evidence changes a stated limitation.
- Test: all `src/shared/video/*.test.ts*`, `src/apps/apps.test.tsx`, project tests.

- [ ] **Step 1: Add README usage notes**

  Document the video tab, local audio requirement, YouTube preview-only behavior, Chrome/Safari capability check, and the `1–30秒` output rule in Japanese.

- [ ] **Step 2: Run the complete automated suite**

  Run `npm test` and `npm run build`.

- [ ] **Step 3: Run a production preview smoke check**

  Run `npm run dev` or `npm run preview`, open all 4 hash routes, and verify the video tab renders without runtime errors. Use a short local WAV fixture to verify the browser download flow where the environment permits it.

- [ ] **Step 4: Review the final diff and commit documentation**

  Run `git diff --check`, verify no generated media or secrets are tracked, and commit with `docs: document audio player video export` if README changed.

## Final Review and Pull Request

After Task 7, generate a review package against `git merge-base main HEAD` and dispatch the `final-review` subagent with the complete design requirements. If it reports findings, dispatch one fix subagent with all findings, run exactly one scoped re-review, and repeat only until the final reviewer reports no actionable findings. Then run `npm test` and `npm run build` again, use `superpowers:finishing-a-development-branch`, push a new branch from the detached HEAD, and create a PR against `main`.
