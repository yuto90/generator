# Agent Instructions — Generator

このファイルは generator リポジトリ専用の Claude Code / Codex 共通入口です。
詳細な起動・テスト・アプリ追加手順は `generator-project-guide` skill を参照してください。

## 共通開発ルール

- 日本語で簡潔に回答する。
- 変更前に方針を説明する。
- 破壊的な操作は事前に確認する。
- UIテキスト、コードコメント、説明は日本語で統一する。
- 変更後は `npm test`(= `vitest run` + `node --test tests/*.test.js`)を実行する。
- 実装後に変更点、確認結果、残タスクをまとめる。

## リポジトリ方針

- generator は複数のジェネレーターを 1 つの Vite + React + TypeScript SPA として管理するリポジトリです。
- 各アプリは `src/apps/<app-name>/` に置き、`src/generators.tsx` のレジストリへ登録してポータルからアクセスできるようにします。
- テーマ・キャプチャ・YouTube 連携などの共通処理は `src/shared/` を利用し、アプリ固有に重複実装しません。
- ローカル確認は `npm run dev`(Vite dev サーバー)で行います。
- MCPの秘密値は `.agent-shared/mcp/servers.json` に直書きせず、`env_vars`、`bearer_token_env_var`、`env_http_headers` で環境変数名だけを共有します。

## Skillルーター

| 必要な情報 | 読み込むskill | 主な用途 |
| --- | --- | --- |
| 起動・テスト・アプリ追加 | `generator-project-guide` | 開発サーバー、テスト、ディレクトリ構成、共有モジュールの確認 |

## 運用ルール

1. タスク開始時に関係するskillだけを読みます。
2. 恒久的なプロジェクト知識は、この入口を肥大化させず関連skillへ追加します。
