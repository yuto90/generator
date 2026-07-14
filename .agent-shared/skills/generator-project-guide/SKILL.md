---
name: generator-project-guide
description: Run, test, and extend the Generator static web repository. Use when working on the Generator portal, adding or modifying a generator app, changing shared theme behavior, starting the local server, or verifying repository changes.
---

# Generator Project Guide

このリポジトリの静的ポータルと各ジェネレーターを、既存構成に沿って変更・検証します。

## 起動

リポジトリルートから次を実行します。

```bash
python3 -m http.server 8000
```

`http://127.0.0.1:8000/` でポータルを確認します。個別アプリも同じサーバー配下のサブディレクトリとして開きます。

## テスト

変更後は全テストを実行します。

```bash
node --test tests/*.test.js
```

静的サーバーやCodex環境を変更した場合は、対象スクリプトのテストも個別に実行します。

## アプリの追加・変更

1. 新しいアプリは `<app-name>/index.html` と必要なJavaScriptをルート直下に配置します。
2. ルートの `index.html` から新しいアプリへ遷移できるようにします。
3. テーマが必要な場合はルートの `theme.js` を再利用します。
4. 親ポータルとiframe間のテーマメッセージは、既存のorigin検証を維持します。
5. 外部placeholder画像や到達不能なassetを追加しません。

## 変更時の境界

- package managerやbuild systemは、必要性が明確でない限り導入しません。
- 各アプリを個別サーバーで起動する構成へ変更しません。
- 既存アプリの見た目や挙動を、依頼範囲外で統一・リファクタリングしません。
