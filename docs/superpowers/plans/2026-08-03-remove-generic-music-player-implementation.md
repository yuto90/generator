# 汎用Music Playerジェネレータ削除 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 汎用グラスデザインの`music_player`を実装・ポータル・テスト・現行ドキュメントから削除し、Apple Musicを既存ルーティングの既定表示にする。

**Architecture:** `GENERATORS`をサイドバーとルーティングの単一データソースとして維持し、先頭の`music_player`項目だけを削除する。専用アプリファイルと専用テストを削除し、レジストリの不在とApple Musicの先頭位置を新しいVitestで固定する。共有モジュール、残るアプリ、既存のワイルドカード遷移は変更しない。

**Tech Stack:** React 19、TypeScript 5.8、React Router 7、Vite 6、Vitest 3、Testing Library。

## Global Constraints

- GitHub Issue #38と承認済み設計書`docs/superpowers/specs/2026-08-03-remove-generic-music-player-design.md`だけを実装範囲とする。
- UIテキスト、テスト名、コメント、説明は日本語にする。
- `GeneratorDef`、共有モジュール、残る4ジェネレータの挙動を変更しない。
- `musicIcon`はApple Musicが利用するため削除しない。
- `#/music_player`と`#music_player`専用のルートや案内画面を追加しない。
- 過去の設計書・実装計画と`src/shared/youtube/`の由来コメントを変更しない。
- 依存関係が未導入の場合だけ、リポジトリ既定手順の`npm install`を実行する。
- 実装後は`npm test`と`npm run build`を実行する。

---

### Task 1: レジストリの回帰テストと汎用アプリの削除

**Files:**
- Create: `src/generators.test.tsx`
- Modify: `src/generators.tsx:25`
- Modify: `src/apps/apps.test.tsx:1`
- Delete: `src/apps/music_player/MusicPlayerApp.tsx`
- Delete: `src/apps/music_player/icons.tsx`
- Delete: `src/apps/music_player/music-player.css`

**Interfaces:**
- Consumes: 既存の`GeneratorDef`と`GENERATORS: GeneratorDef[]`。
- Produces: `music_player`を含まず、`apple_music_player`を先頭要素とする`GENERATORS`。型とexport名は変更しない。

- [ ] **Step 1: テスト実行に必要な依存関係を確認する**

Run:

```bash
test -d node_modules || npm install
```

Expected: `node_modules`が利用可能になり、`package.json`と`package-lock.json`に変更が発生しない。

- [ ] **Step 2: レジストリの失敗テストを追加する**

`src/generators.test.tsx`を次の内容で作成する。

```tsx
import { describe, expect, test } from 'vitest';
import { GENERATORS } from './generators';

describe('ジェネレータレジストリ', () => {
  test('汎用Music Playerを公開せずApple Musicを既定にする', () => {
    expect(GENERATORS.map(generator => generator.id)).not.toContain('music_player');
    expect(GENERATORS[0]?.id).toBe('apple_music_player');
  });
});
```

- [ ] **Step 3: 新しいテストが現行実装で失敗することを確認する**

Run:

```bash
npm run test:unit -- src/generators.test.tsx
```

Expected: `GENERATORS`に`music_player`が含まれているため失敗する。

- [ ] **Step 4: レジストリから汎用版の項目だけを削除する**

`src/generators.tsx`の`GENERATORS`先頭から、次のオブジェクト全体を削除する。

```tsx
{
  id: 'music_player',
  name: 'Music Player',
  desc: '汎用グラスデザイン',
  title: 'music player generator',
  color: 'linear-gradient(135deg, #7c6af0, #5b4fe0)',
  icon: musicIcon,
  Component: lazy(() => import('./apps/music_player/MusicPlayerApp')),
},
```

ファイル上部の`musicIcon`はApple Musicの`icon`として残す。

- [ ] **Step 5: 汎用版専用のアプリ実装を削除する**

Run:

```bash
git rm src/apps/music_player/MusicPlayerApp.tsx src/apps/music_player/icons.tsx src/apps/music_player/music-player.css
```

Expected: `src/apps/music_player/`に追跡対象ファイルが残らない。

- [ ] **Step 6: コンポーネントテストから汎用版だけを削除する**

`src/apps/apps.test.tsx`から次を削除する。

```tsx
import MusicPlayerApp from './music_player/MusicPlayerApp';
```

`describe('MusicPlayerApp', ...)`ブロック全体を削除する。`describe('画像保存ボタン', ...)`の`test.each`から次の1行だけを削除する。

```tsx
['MusicPlayerApp', () => <MusicPlayerApp />],
```

Apple Music、YouTube Music、Instagram Reel、Spotify Styleのテストは変更しない。

- [ ] **Step 7: レジストリと残るアプリの対象テストを実行する**

Run:

```bash
npm run test:unit -- src/generators.test.tsx src/apps/apps.test.tsx
```

Expected: 新しいレジストリテストと、汎用版を除く既存アプリテストがすべて成功する。

- [ ] **Step 8: 削除後の型チェックとバンドルを確認する**

Run:

```bash
npm run build
```

Expected: TypeScriptとViteビルドが成功し、`MusicPlayerApp`または`src/apps/music_player/`への未解決importがない。

- [ ] **Step 9: アプリ削除をコミットする**

```bash
git add src/generators.test.tsx src/generators.tsx src/apps/apps.test.tsx
git commit -m "feat: remove generic music player generator"
```

### Task 2: 現行ドキュメント更新と全体検証

**Files:**
- Modify: `src/App.tsx:6`
- Modify: `README.md:25`
- Modify: `.agent-shared/skills/generator-project-guide/SKILL.md:24`
- Add: `docs/superpowers/specs/2026-08-03-remove-generic-music-player-design.md`
- Add: `docs/superpowers/plans/2026-08-03-remove-generic-music-player-implementation.md`

**Interfaces:**
- Consumes: Task 1で`apple_music_player`が先頭になった`GENERATORS`と、既存のワイルドカードルート。
- Produces: 残るルートだけを案内する現行ドキュメント。ルーティングの関数、型、実行時挙動は変更しない。

- [ ] **Step 1: 旧ハッシュURLの説明例をApple Musicへ更新する**

`src/App.tsx`のコメントだけを次へ置き換える。

```tsx
// 旧ポータルの URL は `/#apple_music_player` のような形式だったため、
// ハッシュルーターの `#/apple_music_player` 形式へ正規化してブックマークを生かす
```

`legacyHash`、`defaultPath`、`createHashRouter`の実装は変更しない。

- [ ] **Step 2: READMEから削除済みルートを除く**

`README.md`の直接アクセスURL一覧から次の1行だけを削除する。

```markdown
- music_player: http://localhost:5173/#/music_player
```

残る4ルートと起動・ビルド手順は変更しない。

- [ ] **Step 3: プロジェクトskillのルート例を更新する**

`.agent-shared/skills/generator-project-guide/SKILL.md`の起動説明を次へ置き換える。

```markdown
`http://localhost:5173/` でポータルを確認します。各アプリは `#/apple_music_player` のようなハッシュルートで開きます。
```

- [ ] **Step 4: 実行コードと現行ドキュメントの参照残りを確認する**

Run:

```bash
rg --hidden -n "MusicPlayerApp|apps/music_player|id: 'music_player'|#/music_player" src README.md .agent-shared
```

Expected: 出力なし。終了コード1は「一致なし」を表すため成功条件とする。過去の`docs/superpowers/`と`src/shared/youtube/`の由来コメントはこの検索対象・パターンで変更対象にしない。

- [ ] **Step 5: 全テストを実行する**

Run:

```bash
npm test
```

Expected: Vitest全件と`node --test tests/*.test.js`全件が成功する。

- [ ] **Step 6: 本番ビルドを再確認する**

Run:

```bash
npm run build
```

Expected: TypeScriptチェックとVite本番ビルドが成功する。

- [ ] **Step 7: ブラウザでルーティングと残るUIを確認する**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: クリーン起動した開発サーバーで次を確認できる。

1. `#/`でApple Musicが表示され、サイドバーとモバイルヘッダーにApple Musicが表示される。
2. `#/music_player`で削除済み画面が表示されず、Apple Musicへ置換遷移する。
3. `#music_player`でも削除済み画面が表示されず、Apple Musicへ置換遷移する。
4. サイドバーに「Music Player / 汎用グラスデザイン」が存在しない。
5. Apple Music、YouTube Music、Spotify Style、Instagram Reelの各ルートを表示できる。

- [ ] **Step 8: ドキュメントと説明更新をコミットする**

```bash
git add src/App.tsx README.md .agent-shared/skills/generator-project-guide/SKILL.md docs/superpowers/specs/2026-08-03-remove-generic-music-player-design.md docs/superpowers/plans/2026-08-03-remove-generic-music-player-implementation.md
git commit -m "docs: update references after music player removal"
```

- [ ] **Step 9: 最終の作業ツリーを確認する**

Run:

```bash
git status --short
```

Expected: 出力なし。承認済み対象外のファイルが変更されていない。
