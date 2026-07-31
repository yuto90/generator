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

- music_player: http://localhost:5173/#/music_player
- apple_music_player: http://localhost:5173/#/apple_music_player
- youtube_music_player: http://localhost:5173/#/youtube_music_player
- spotify_player: http://localhost:5173/#/spotify_player
- instagram_reel: http://localhost:5173/#/instagram_reel

## 音声プレーヤーの動画出力

Music Player、Apple Music、YouTube Music、Spotify Style の保存パネルでは、従来どおり「画像」タブからPNGを保存できます。「動画」タブでは、ローカル音源を選び、開始位置を指定してMP4を保存します。

- 動画出力にはローカル音源が必須です。出力は開始位置から最大30秒（曲末では1秒以上30秒未満）です。
- 出力は幅1080px・30fpsのMP4（H.264映像／AAC音声）です。ChromeとSafariでの利用を想定しており、保存時にブラウザのエンコード対応状況を確認します。
- YouTube URLはプレビュー専用です。YouTube音声は動画へ出力されません。

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
