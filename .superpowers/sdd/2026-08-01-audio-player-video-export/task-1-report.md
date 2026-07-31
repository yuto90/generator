# Task 1 実装レポート

## 変更概要

- `src/shared/video/video-types.ts` に動画クリップ、プレイヤーフレーム、ローカル音源の共有型を追加。
- `src/shared/video/video-timeline.ts` に開始時刻の解析、最大30秒のクリップ範囲算出、フレーム時刻、出力高算出を追加。
- `src/shared/video/useLocalAudio.ts` にローカルファイル選択、Object URL の置換・解放、音源メタデータ/再生状態の同期、Web Audio API によるデコード、再生操作を追加。
- 上記の仕様を検証する Vitest テストを追加。テスト先行で、各モジュール未作成時の import 解決失敗を確認してから実装した。

## コミット

- `feat: add video timeline and local audio primitives`

## テスト結果

- `npx vitest run src/shared/video/video-timeline.test.ts src/shared/video/useLocalAudio.test.ts`
  - 成功: 2 files / 26 tests
- `npm test`
  - 成功: Vitest 8 files / 48 tests、Node test 8 tests
- `npm run build`
  - 成功: TypeScript 型検査と Vite production build

## 懸念点

- 要求書どおりの `npm test -- src/shared/video/video-timeline.test.ts src/shared/video/useLocalAudio.test.ts` は、`npm test` スクリプトが `vitest run && node --test tests/*.test.js` であるため、後半の Node test にも対象ファイル引数が渡ります。その結果、Node が TypeScript/Vitest テストを直接解釈して import 解決に失敗します。Vitest 部分は 2 files / 26 tests で成功しています。集中実行は `npx vitest run ...` を使用しました。スクリプト修正は本タスクの対象外のため行っていません。
