# Apple Music・Spotify Android Now Playing 全面表示設計

## 背景

GitHub Issue #40 / PR #41 で、4ジェネレーターへ端末サイズプレビューと高解像度PNG保存を追加した。YouTube Musicは端末キャンバス全体を使うレイアウトへ追補済みだが、Apple MusicとSpotifyは旧340pxカード由来の通常フローを残している。そのため、Pixel 10 Pro XLの論理`448×997`ではカード背景だけが下部へ続き、Apple Musicは約250px、Spotifyは約259pxの実質的な未使用領域が生じる。

利用者は、Pixel 10 Pro XLで生成した画像を実際の音楽アプリのスクリーンショットと同様に画面全体へ表示し、鮮明な`1344×2992` PNGとして保存したい。今回の追補では、Apple MusicとSpotifyのプレビューを最新のAndroid版Now Playingの情報階層へ合わせ、縦長キャンバス全体を意味のある表示へ使う。

## 参照UI

2026-08-10時点で次の公開情報を参照する。

- Apple Music Android
  - [Google Play掲載ページ](https://play.google.com/store/apps/details?id=com.apple.android.music&hl=en&gl=US)
  - [Android版フルスクリーンプレーヤーとAnimated Art](https://www.androidcentral.com/apps-software/apple-music-beta-android-new-now-playing-screen)
  - [Android 5.0ではLiquid Glassを採用せず既存デザインを維持](https://9to5google.com/2025/09/23/apple-music-5-0-stable-ios-26/)
  - [Apple公式Now Playing操作一覧](https://support.apple.com/guide/iphone/use-the-music-player-controls-iph676daac9b/26/ios/26)
- Spotify Android
  - [Google Play掲載ページ](https://play.google.com/store/apps/details?id=com.spotify.music&hl=en&gl=US)
  - [Spotify公式Now Playingガイド](https://support.spotify.com/uk/article/now-playing/)
  - [2026年のNow Playing追加情報領域](https://newsroom.spotify.com/2026-02-06/about-the-song-beta/)

参照優先順位は、Android公式ストア掲載、各サービス公式サポート、Android版UIを確認できる公開記事の順とする。AppleのiOS用Liquid Glass、iPhone固有のAirPlay表記、OSステータスバー、パンチホール、ホームインジケーターはPixel向け生成画像へ移植しない。

## 対象範囲

### 変更するもの

- `AppleMusicPlayerApp`の保存対象となるNow Playing UI
- `SpotifyPlayerApp`の保存対象となるNow Playing UI
- 2画面のコンテナクエリと縦方向レイアウト
- Android固有のメニュー・Chromecast・Spotify Connect・キュー表現
- 画面内から外す音量操作を編集パネルへ移し、YouTube再生の音量調整機能を維持する
- DOM構造・操作名・保存経路の回帰テスト
- Pixel 10 Pro XLを含む代表サイズでのブラウザ表示と実PNG確認

### 維持するもの

- Issue #40の端末ツールバー、縦向き制約、論理サイズ、物理保存サイズ
- Pixel 10 Pro XLの論理`448×997`と物理`1344×2992`
- 画像選択・正方形トリミング・タイトル・アーティスト・出典入力
- YouTube URLによる再生、再生位置変更、再生・一時停止、音量変更
- テーマ切替、カラーピッカー、保存中表示、エラー変換、Safari対策
- YouTube MusicとInstagram Reelの表示・保存
- 編集フォームと端末ツールバーをPNGへ含めない契約

### 対象外

- OSステータスバー、パンチホール、端末枠、ホームインジケーター
- Apple MusicのLiquid GlassやAirPlay表示
- Spotifyの地域・アカウント限定ベータカードを常時表示すること
- 外部APIによるアートワークの主要色解析
- 入力項目や保存ファイル形式の追加

## Apple Music Android画面

### 視覚構成

保存対象の`.am-card`を角丸カードではなく端末キャンバス全面のプレーヤーにする。選択したカバー画像を上部から画面中央まで大きく表示し、同じ画像を背景へ使う。下部へ向かう暗いグラデーションを重ね、曲情報と操作の可読性を確保する。

縦方向は次の4層で構成する。

1. 上端の短いグラバー
2. 全幅のアートワーク領域
3. 曲名、アーティスト、お気に入り、Android縦3点メニュー、再生位置、経過・残り時間、Dolby Atmos表示
4. 前へ・再生/一時停止・次へ、歌詞・Chromecast・キュー、出典

アートワークは余剰高を受け取る領域とし、操作群は下端へまとまって配置する。Pixel 10 Pro XLでは上部約55〜62%をアートワークとして見せ、下部操作の最後がカード下端から概ね16〜28pxに収まる。背景だけの大きな帯は作らない。

### Android固有表現

- その他メニューは縦3点で表示する。
- 再生先は`AirPlay`ではなく`Chromecast`としてアクセシブル名を付ける。
- お気に入りは星形、その他は丸い半透明ボタンにする。
- OS表示は描画しない。

### レスポンシブ

- `320×568`ではアートワーク領域を縮め、全操作を欠けさせない。
- `375×667`、`412×924`、`448×997`ではアートワークと操作群の比率を段階的に広げる。
- 正方形・タブレットでは操作群の最大幅を制限し、横へ間延びさせない。
- `container-type: size`と既存の論理幅・高さCSS変数を使い、window幅へ依存しない。

## Spotify Android画面

### 視覚構成

保存対象の`.spotify-card`を端末キャンバス全面へ広げ、角丸・外枠・外側シャドウをなくす。カバー画像を複製したぼかし背景と暗いオーバーレイを背面へ置き、現在のSpotify Android Now Playingに近いアートワーク由来の暗色背景を作る。

縦方向は次の4層で構成する。

1. 閉じる、再生元の2行ラベル、Android縦3点メニュー
2. 中央配置の大きな正方形アートワーク
3. 曲名、アーティスト、ライブラリ保存、再生位置、時刻、シャッフル・前へ・再生/一時停止・次へ・リピート
4. Spotify Connectとキュー

アートワーク用フレームが余剰高を受け取り、操作群と接続行は下側へ配置する。Pixel 10 Pro XLではアートワークを内容幅いっぱいに近い正方形で表示し、Spotify Connect・キュー行を下端から概ね18〜32pxに配置する。

### Android固有表現

- その他メニューは縦3点で表示する。
- 曲の保存は現在の円囲みプラスとして表示し、アクセシブル名を`ライブラリに保存`とする。
- 下端へ`再生デバイス`と`キュー`の操作を置く。
- 携帯版Now Playingにない音量バーは保存画像から外し、同じ音量操作を編集パネルへ移す。

### レスポンシブ

- アートワークは常に正方形を維持する。
- 短いキャンバスでは`height - control area`を上限に縮小し、操作群との重なりを防ぐ。
- 縦長キャンバスではアートワークフレーム内の余白として分散し、下部に背景だけの帯を残さない。
- タブレットではアートワークと操作群へ最大幅を設け、中央配置する。

## 操作・状態

- タイトル、アーティスト、画像、再生時間の適用方法は変えない。
- 再生・一時停止ボタンの状態とアイコンは既存のYouTubeプレーヤー状態へ同期する。
- 再生位置スライダーは既存の静的・YouTube両モードを維持する。
- 音量スライダーは両アプリとも編集パネルに置き、既存の`setVolume`とYouTubeプレーヤー連携を維持する。
- Apple Musicの出典は下端へ小さく表示し続ける。
- テーマ切替は編集画面を引き続き切り替える。Spotifyの保存対象はブランド準拠の暗色を基本とし、Apple Musicは既存カラーピッカーの背景・ポイント・文字色を反映する。

## アクセシビリティ

- アイコンだけの操作には日本語の`aria-label`を付ける。
- Spotifyのキューは装飾SVGではなくbuttonにする。
- 既存のrange inputのラベル、キーボード操作、フォーカス表示を維持する。
- 背景画像には暗いオーバーレイを重ね、文字・操作のコントラストを確保する。

## テスト・検証

### 自動テスト

- Apple Musicが、お気に入り、縦3点メニュー、Chromecast、キュー、編集パネル内音量を描画する。
- Spotifyが、再生元、縦3点メニュー、ライブラリ保存、再生デバイス、キュー、編集パネル内音量を描画する。
- 両アプリの既存入力・再生・保存テストが通る。
- Pixel 10 Pro XLで、論理`448×997`のcloneを物理`1344×2992`へ保存する既存契約を維持する。
- `npm test`と`npm run build`を成功させる。

### ブラウザ・画像検証

少なくとも`320×568`、`375×667`、`448×997`、`768×1024`で次を確認する。

- 全操作がキャンバス内にあり、重なり・切れ・意図しないスクロールがない。
- Apple Musicの上部がアートワークで満たされ、下部操作が下端付近へ収まる。
- Spotifyのアートワークが正方形で、接続・キュー行が下端付近へ収まる。
- Pixel 10 Pro XLの実ダウンロードPNGが両アプリとも`1344×2992 RGBA`である。
- PNGの四辺まで背景があり、編集UI・端末ツールバー・OS表示を含まない。

## 完了条件

- Apple MusicとSpotifyの両方が最新Android Now Playingの情報階層へ更新される。
- Pixel 10 Pro XLで下部に大きな未使用帯がなく、全面を意味のある表示へ使う。
- 既存の入力・画像編集・再生・テーマ・高解像度保存が回帰しない。
- 自動テスト、ビルド、代表サイズのブラウザ確認、実PNG寸法確認、ローカルレビュー、PR checksがすべて成功する。

