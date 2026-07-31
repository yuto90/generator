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

## レビュー修正

- 画像保存の Promise 完了まで保存ボタンを無効化し、連打によるPNGの二重生成を防止した。
- Spotify の未使用 children JSX を削除し、表示・出力とも `SpotifyPlayerCard` のプロパティだけで描画するよう整理した。
- 修正後の `npm test`（69 Vitest tests、8 Node tests）と `npm run build` は通過した。

## 再レビュー修正

- Music Player、Apple Music、YouTube Music のPNG保存ハンドラが `capture` のPromiseを返すようにし、共通パネルの保存ロックを生成完了まで維持した。
- Music Playerで遅延したPNG生成中に保存ボタンが無効のままになる結合テストを追加した。
- 修正後の `npm test`（70 Vitest tests、8 Node tests）と `npm run build` は通過した。
