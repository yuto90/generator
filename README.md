# generator

複数のジェネレーターアプリを 1 つの Vite + React + TypeScript SPA として管理するリポジトリです。
左サイドバーのポータルからジェネレーターを選ぶと、メイン画面に表示されます。

## ローカル起動方法

初回のみ依存をインストールします。

```bash
cd /Users/apple/dev/generator
npm install
```

開発サーバーを起動します。

```bash
npm run dev
```

起動後、http://localhost:5173/ を開くとポータル画面が表示されます。

各アプリにはハッシュルートで直接アクセスすることもできます。

- apple_music_player: http://localhost:5173/#/apple_music_player
- youtube_music_player: http://localhost:5173/#/youtube_music_player
- spotify_player: http://localhost:5173/#/spotify_player
- instagram_reel: http://localhost:5173/#/instagram_reel

## ビルドとテスト

```bash
npm run build    # 型チェック + 本番ビルド(dist/)
npm run preview  # ビルド成果物の確認
npm test         # vitest run + node --test tests/*.test.js
```

`dist/` は任意の静的サーバーで配信できます(ハッシュルーターのため SPA フォールバック設定は不要です)。

## アプリの追加

1. `src/apps/<app-name>/` にコンポーネントと CSS を追加します。
2. `src/generators.tsx` のレジストリに登録すると、サイドバーとルーティングに反映されます。

詳細は `.agent-shared/skills/generator-project-guide/SKILL.md` を参照してください。
