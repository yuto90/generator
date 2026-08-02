# 汎用Music Playerジェネレータ削除の設計

## 背景と目的

GitHub Issue #38に基づき、ポータルに登録されている汎用グラスデザインの`Music Player`ジェネレータ（`music_player`）を削除する。Apple Music、YouTube Music、Spotify Style、Instagram Reelは維持し、削除による機能追加や既存アプリの改修は行わない。

## 現行構成

`src/generators.tsx`の`GENERATORS`が、サイドバー、ハッシュルート、既定表示、モバイルヘッダー、`document.title`の単一データソースになっている。現在の`music_player`は配列先頭にあり、実装は`src/apps/music_player/`のコンポーネント、アイコン、CSSに閉じている。

汎用版は`src/shared/`のキャプチャ、画像トリミング、テーマ、YouTube解析を利用するが、これらは残るジェネレータも利用している。`src/generators.tsx`の`musicIcon`もApple Musicが利用している。

## 採用方針

汎用版をポータルから隠すだけではなく、アプリ実装、レジストリ登録、専用テスト、現行ドキュメントの参照を完全に削除する。

削除済みルート専用の互換ルートや案内画面は追加しない。`GENERATORS[0]`を既定表示にする既存ルーティングを維持し、削除後に配列先頭となるApple Musicを既定表示にする。

明示的な`music_player`リダイレクトを追加する案は、既存のワイルドカード遷移と重複するため採用しない。実装だけを残してレジストリから外す案は、未使用コードを残して削除目的を満たさないため採用しない。

## 影響範囲

### 削除するファイル

- `src/apps/music_player/MusicPlayerApp.tsx`
- `src/apps/music_player/icons.tsx`
- `src/apps/music_player/music-player.css`

### 変更するファイル

- `src/generators.tsx`
  - `id: 'music_player'`のレジストリ項目だけを削除する。
  - Apple Musicが利用する`musicIcon`は維持する。
- `src/apps/apps.test.tsx`
  - `MusicPlayerApp`のimport、専用テスト2件、画像保存のパラメータ化テスト1件を削除する。
- `src/App.tsx`
  - 旧ハッシュURLの説明例を、残るApple MusicのURLへ更新する。ルーティング実装は変更しない。
- `README.md`
  - `music_player`の直接アクセスURLを削除する。
- `.agent-shared/skills/generator-project-guide/SKILL.md`
  - ハッシュルートの例を、残るApple MusicのURLへ更新する。

### 追加するファイル

- `src/generators.test.tsx`
  - `music_player`がレジストリに存在しないことを固定する。
  - Apple Musicが配列先頭であり、既定表示になることを固定する。

## データ構造

`GeneratorDef`の型、各フィールド、遅延ロード方式は変更しない。`GENERATORS`の要素数だけを5件から4件へ減らす。永続データ、ユーザー設定、フォーム状態、ローカルストレージの移行は発生しない。

## UIとルーティング

- デスクトップとモバイルで共通利用されるサイドバーから「Music Player / 汎用グラスデザイン」が消える。
- `#/`はApple Musicへ置換遷移し、Apple Musicの画面、モバイルヘッダー、`document.title`を表示する。
- `#/music_player`と旧形式`#music_player`では削除済み画面を表示せず、既存の不明ルート処理によりApple Musicへ置換遷移する。
- Apple Music、YouTube Music、Spotify Style、Instagram Reelの表示、入力、画像保存、テーマ、レスポンシブ挙動は変更しない。
- サイドバーフッターの「music player generators」とルート`index.html`のサイトタイトルは、残る音声系ジェネレータ群にも当てはまるため変更しない。

## エラー処理

新しいエラー状態やエラーUIは追加しない。削除済みルートは既存のワイルドカード遷移で処理し、到達不能な遅延importを残さない。ビルドで未解決importがないことを検証する。

## ドキュメントと履歴

READMEとプロジェクトskillは現在の利用方法を説明する文書として更新する。過去の設計書・実装計画は当時の履歴として変更しない。`src/shared/youtube/`の「music_player由来」というコメントとテスト名も共有処理の由来を表す履歴として維持する。

Issue #31の本文変更は本実装の対象外とし、Issue #38に記載済みの関連情報だけを維持する。

## テスト方針

1. `src/generators.test.tsx`を先に追加し、現行レジストリでは失敗することを確認する。
2. レジストリとアプリ実装を削除し、レジストリテストと残るアプリのコンポーネントテストが成功することを確認する。
3. `npm test`でVitestとNode契約テストを実行する。
4. `npm run build`でTypeScriptとViteのビルドを実行し、削除済みimportが残っていないことを確認する。
5. 隠しファイルを含む参照検索で、実行コードと現行ドキュメントに削除対象の参照が残っていないことを確認する。
6. ブラウザで`#/`、`#/music_player`、`#music_player`、残る4ルート、デスクトップとモバイルのサイドバーを確認する。

## 受け入れ条件

- サイドバーに「Music Player / 汎用グラスデザイン」が表示されない。
- `#/music_player`と`#music_player`で削除済み画面が表示されず、Apple Musicへ遷移する。
- `#/`でApple Musicが既定表示される。
- Apple Music、YouTube Music、Spotify Style、Instagram Reelを引き続き表示・操作できる。
- 削除済みコンポーネントへのimportや遅延ロード参照が残らない。
- `npm test`と`npm run build`が成功する。

## 対象外

- 残るジェネレータの機能、見た目、文言の変更
- `src/shared/`の削除、変更、リファクタリング
- 新しい404画面、削除案内、代替ジェネレータの追加
- 過去の設計書・実装計画の書き換え
- Issue #31の編集
