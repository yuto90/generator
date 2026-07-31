# Task 6 report — Spotify Style video export

## 実装

- `SpotifyPlayerCard` を表示専用コンポーネントとして追加し、通常プレビューと画面外の動画出力で同じカードを使うようにした。
- 共通 `VideoExportPanel` と `useLocalAudio` を接続した。ローカル音源を選ぶと再生・シーク・音量を優先し、その duration と playhead を動画フレームへ渡す。
- 静的時刻フォールバック、フォーム検証、YouTube プレビュー・ステータス、PNG保存を維持した。動画の進捗・再試行・YouTube音声除外表示は共通パネルに委譲した。

## 検証

- RED: `npm test -- src/apps/apps.test.tsx` で動画タブ未実装による `role=tab name=動画` の未検出を確認。
- `npx vitest run src/apps/apps.test.tsx` — 10 tests passed。
- `npx tsc --noEmit` — passed。
- `npm test` — 68 Vitest tests と 8 Node tests passed。
- `npm run build` — passed。
- `git diff --check` — passed。
