---
name: generator-project-guide
description: Run, test, and extend the Generator web repository. Use when working on the Generator portal, adding or modifying a generator app, changing shared theme behavior, starting the local server, or verifying repository changes.
---

# Generator Project Guide

このリポジトリは Vite + React + TypeScript の SPA として、ポータルと各ジェネレーターを管理します。

## 起動

初回のみ依存をインストールします。

```bash
npm install
```

リポジトリルートから開発サーバーを起動します。

```bash
npm run dev
```

`http://localhost:5173/` でポータルを確認します。各アプリは `#/apple_music_player` のようなハッシュルートで開きます。

本番ビルドの確認は次を実行します。

```bash
npm run build && npm run preview
```

## テスト

変更後は全テストを実行します。

```bash
npm test
```

これは `vitest run`(src 配下の単体・コンポーネントテスト)と `node --test tests/*.test.js`(リポジトリ構成の検証)を順に実行します。静的サーバーやCodex環境を変更した場合は、対象スクリプトのテストも個別に実行します。

## ディレクトリ構成

- `src/portal/` — サイドバー・モバイルドロワーなどポータルのシェル
- `src/apps/<app-name>/` — 各ジェネレーター(コンポーネント + `.app-<id>` スコープの CSS)
- `src/shared/` — 共通モジュール
  - `theme/` — ThemeProvider / useTheme / ThemeToggle(localStorage キー `generator-theme`)
  - `capture/useCapture.ts` — html-to-image による PNG 保存
  - `youtube/` — `extractYouTubeId` と YouTube IFrame API フック(`useYouTubePlayer`)
  - `player/player-utils.ts` — 時間表記・進捗計算
  - `styles/` — Tailwind エントリと共通デザイントークン(`--gen-*`)
- `src/generators.tsx` — アプリのレジストリ(サイドバー表示とルートを生成)

## アプリの追加・変更

1. 新しいアプリは `src/apps/<app-name>/` にコンポーネントと CSS を配置します。
2. CSS はアプリのルート要素クラス(`.app-<id>`)配下にスコープし、他アプリへ漏らしません。
3. `src/generators.tsx` のレジストリに `id / name / desc / title / color / icon / Component(lazy)` を登録します。
4. テーマは `useTheme` / `ThemeToggle` を再利用します。キャプチャは `useCapture`、YouTube 再生は `useYouTubePlayer` を使います。
5. 外部placeholder画像や到達不能なassetを追加しません。

## 変更時の境界

- 各アプリを個別サーバーで起動する構成へ変更しません。
- 既存アプリの見た目や挙動を、依頼範囲外で統一・リファクタリングしません。
- YouTube IFrame API の読み込みは `useYouTubePlayer` のシングルトンに集約し、`window.onYouTubeIframeAPIReady` を直接上書きしません。
