# generator

このリポジトリでは、今後プロジェクトルート直下に複数のジェネレーターアプリを追加していく想定です。
ローカル確認時は、各アプリのフォルダに移動して個別に起動するのではなく、プロジェクトルートをそのまま静的サーバーで配信してください。

## ローカル起動方法

プロジェクトルートで次を実行します。

```bash
cd /Users/apple/dev/generator
python3 -m http.server 8000
```

起動後、http://127.0.0.1:8000/ を開くとポータル画面が表示されます。
左サイドバーからジェネレータを選ぶと、メイン画面に表示されます。

各アプリに直接アクセスすることもできます。

- music_player: http://127.0.0.1:8000/music_player/
- apple_music_player: http://127.0.0.1:8000/apple_music_player/
- youtube_music_player: http://127.0.0.1:8000/youtube_music_player/

今後アプリが増えた場合も、同じサーバーで次のように開けます。

- example_app: http://127.0.0.1:8000/example_app/

## 補足

- 停止するときは `Ctrl+C` を押します。
- `8000` 番ポートが使用中なら、`python3 -m http.server 8080` のように別ポートを指定してください。
