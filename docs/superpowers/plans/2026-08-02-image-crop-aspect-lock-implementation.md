# トリミング比率固定モード Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 画像トリミングダイアログに、プレビュー枠と同じ比率で選択範囲を固定し、余白なしで表示できるトグルを追加する。

**Architecture:** `EditableImage` に固定状態を保持し、画像比率変換は `src/shared/image-crop/image-crop.ts` の純粋関数へ集約する。`ImageCropField` は `ReactCrop` の `aspect` と表示 `fit` を固定状態から制御し、既存の自由比率・余白モードを初期状態として維持する。

**Tech Stack:** React 19、TypeScript、`react-image-crop` 11.1.2、Vitest、Testing Library、Vite。

## Global Constraints

- 初期状態は自由比率・固定OFFで、既存の余白付き表示を維持する。
- 固定ON時は `targetAspect` を選択枠へ渡し、`fit: 'cover'` で余白を表示しない。
- 固定OFF時は `fit: 'contain'` と選択した黒または白の余白色を維持する。
- `cropAspectLocked?: boolean` は未指定を `false` として後方互換にする。
- 画像の回転、反転、フィルター、Canvas上限、保存処理は変更しない。
- UIテキスト、テスト名、コメントは日本語にする。

---

### Task 1: 選択範囲を対象比率へ変換する純粋関数

**Files:**
- Modify: `src/shared/image-crop/image-crop.ts`
- Test: `src/shared/image-crop/image-crop.test.ts`

**Interfaces:**
- Consumes: `PercentCrop`, 画像の表示幅・高さ、`targetAspect`。
- Produces: `fitCropToAspect(crop, width, height, aspect): PercentCrop`。選択範囲の中心を保ち、画像境界内へクランプした対象比率のパーセント範囲を返す。

- [ ] **Step 1: 固定変換の失敗テストを書く**

```ts
test('選択範囲の中心を保ったまま対象比率へ変換する', () => {
  expect(fitCropToAspect(
    { unit: '%', x: 10, y: 20, width: 60, height: 30 },
    1000,
    1000,
    1,
  )).toEqual({ unit: '%', x: 25, y: 20, width: 30, height: 30 });
});

test('比率変換後の範囲を画像境界内へ収める', () => {
  const crop = fitCropToAspect(
    { unit: '%', x: 70, y: 10, width: 30, height: 80 },
    1600,
    900,
    9 / 16,
  );
  expect(crop.x + crop.width).toBeLessThanOrEqual(100);
  expect(crop.y + crop.height).toBeLessThanOrEqual(100);
});
```

- [ ] **Step 2: 対象テストだけ実行して失敗を確認する**

Run: `npm run test:unit -- src/shared/image-crop/image-crop.test.ts`

Expected: `fitCropToAspect` が未定義または期待値不一致で失敗する。

- [ ] **Step 3: 最小実装を追加する**

`fitCropToAspect` では、まずパーセント範囲をピクセル座標へ変換し、現在の中心と選択幅・高さから対象比率の最大内接矩形を計算する。矩形を画像境界へ移動した後、パーセントへ戻す。幅・高さ・比率が不正な場合は `centerAspectCrop(width, height, aspect)` を返す。

- [ ] **Step 4: 対象テストが通ることを確認する**

Run: `npm run test:unit -- src/shared/image-crop/image-crop.test.ts`

Expected: 既存テストを含めて全テストが成功する。

- [ ] **Step 5: ユーティリティをコミットする**

```bash
git add src/shared/image-crop/image-crop.ts src/shared/image-crop/image-crop.test.ts
git commit -m "feat: add crop aspect conversion utility"
```

### Task 2: 編集状態とReactCropの比率固定を追加する

**Files:**
- Modify: `src/shared/image-crop/image-crop.ts`
- Modify: `src/shared/image-crop/ImageCropField.tsx`
- Test: `src/shared/image-crop/ImageCropField.test.tsx`

**Interfaces:**
- Consumes: Task 1の `fitCropToAspect`、既存の `targetAspect`、`EditableImage`。
- Produces: `EditableImage.cropAspectLocked`、固定状態を表すトグル、`ReactCrop aspect`、ON/OFFに応じた `fit` の保存。

- [ ] **Step 1: データモデルとUIの失敗テストを書く**

```tsx
test('枠いっぱいにするをONにすると対象比率固定になり、完了でcoverを返す', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<ImageCropField {...defaultProps} value={createEditableImage('source', 'source')} onChange={onChange} />);

  await user.click(screen.getByRole('button', { name: 'トリミングを調整' }));
  const lockButton = screen.getByRole('button', { name: '枠いっぱいにする' });
  expect(lockButton).toHaveAttribute('aria-pressed', 'false');
  await user.click(lockButton);
  expect(lockButton).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('プレビュー枠と同じ比率で固定中')).toBeInTheDocument();

  // 既存の画像load・crop completeモックを通して完了する。
  await user.click(screen.getByTestId('mock-crop-complete'));
  await waitFor(() => expect(screen.getByRole('button', { name: '完了' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: '完了' }));

  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
    fit: 'cover',
    cropAspectLocked: true,
  }));
});

test('保存済みの固定状態を再編集時に復元する', async () => {
  render(<ImageCropField {...defaultProps} value={{ ...createEditableImage('source', 'source'), cropAspectLocked: true }} />);
  await userEvent.click(screen.getByRole('button', { name: 'トリミングを調整' }));
  expect(screen.getByRole('button', { name: '枠いっぱいにする' })).toHaveAttribute('aria-pressed', 'true');
});
```

- [ ] **Step 2: 対象テストを実行して失敗を確認する**

Run: `npm run test:unit -- src/shared/image-crop/ImageCropField.test.tsx`

Expected: トグルボタン、`cropAspectLocked`、`fit: 'cover'` が未実装のため失敗する。

- [ ] **Step 3: `EditableImage` に固定状態を追加する**

`cropAspectLocked?: boolean` を追加し、`createEditableImage` では `false` を明示する。既存値を壊さないため、フィールド側では `value.cropAspectLocked ?? false` を使う。

- [ ] **Step 4: `ImageCropField` の固定状態を実装する**

`openEditor` で保存済み状態を `draftAspectLocked` へコピーし、トグルON時は `fitCropToAspect` で `draftCrop` を調整する。`ReactCrop` へ次を渡す。

```tsx
aspect={draftAspectLocked ? targetAspect : undefined}
```

`previewImage.fit` と「完了」時の `fit` を `draftAspectLocked ? 'cover' : 'contain'` にし、`cropAspectLocked: draftAspectLocked` を `onChange` の値へ保存する。中央に戻す操作は現在の固定状態を維持する。

- [ ] **Step 5: テストが通ることを確認する**

Run: `npm run test:unit -- src/shared/image-crop/ImageCropField.test.tsx`

Expected: 既存の自由比率・余白色・キャンセル・Escテストを含めて成功する。

- [ ] **Step 6: コンポーネント変更をコミットする**

```bash
git add src/shared/image-crop/image-crop.ts src/shared/image-crop/ImageCropField.tsx src/shared/image-crop/ImageCropField.test.tsx
git commit -m "feat: add fixed crop aspect toggle"
```

### Task 3: 固定モードの表示と全体検証

**Files:**
- Modify: `src/shared/image-crop/image-crop.css`

**Interfaces:**
- Consumes: Task 2のトグルDOMと状態。
- Produces: 固定状態が判別できる日本語UI、全ジェネレーターでの回帰確認。

- [ ] **Step 1: 固定状態の表示スタイルを追加する**

固定トグルを既存の余白色フィールドセットと同じ視覚階層へ配置し、選択時の境界と `aria-pressed` が分かる状態を追加する。小さい画面では既存の縦積みレイアウトを維持する。

- [ ] **Step 2: 全テストとビルドを実行する**

Run: `npm test`

Expected: Vitest全件、Node契約テスト全件が成功する。

Run: `npm run build`

Expected: TypeScriptチェックとViteビルドが成功する。

- [ ] **Step 3: ブラウザで固定・自由の両モードを確認する**

`npm run dev -- --host 127.0.0.1` をクリーン起動し、YouTube Musicの画像入力で以下を確認する。

1. 初期状態は「枠いっぱいにする」がOFFで、自由比率の余白が表示される。
2. ONにすると選択枠の比率が正方形になり、プレビューが枠いっぱいになる。
3. Instagram Reelへ移動し、ON時に9:16で余白がなく、OFF時に余白色が表示される。
4. キャンセル・Escで編集前の固定状態を保持する。

- [ ] **Step 4: 検証結果をコミットし、PRブランチへプッシュする**

```bash
git add src/shared/image-crop/image-crop.css
git commit -m "feat: style crop aspect lock mode"
git push
```
