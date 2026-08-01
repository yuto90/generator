# アップロード画像の自由トリミング機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 画像入力を共通化し、利用者が自由比率の選択枠をドラッグ・リサイズして切り抜き、黒または白の余白付き画像を全ジェネレーターのプレビューと保存結果へ反映できるようにする。

**Architecture:** `src/shared/image-crop/` に画像値の型、中央初期選択、Canvas PNG変換、表示スタイル、`react-image-crop` を使った編集フィールドを配置する。各アプリは編集中値と適用済み値を分け、既存の「適用してプレビュー」で値をコピーし、既存DOMへ共通の背景画像スタイルを適用する。

**Tech Stack:** React 19、TypeScript strict、`react-image-crop@11.1.2`、Canvas、Vitest + Testing Library、既存の `html-to-image`。

## Global Constraints

- UIテキスト、エラー、コメントは日本語で追加する。
- 未調整画像は従来どおり中央 `cover` 表示とし、操作なしの挙動を変えない。
- 切り抜き選択枠は自由比率、初期選択だけ適用先の比率で中央配置する。
- 調整後は `contain` と黒／白の背景色で余白を表示し、画像を変形しない。
- 黒を余白色の初期値とする。変更はダイアログ内で行う。
- Canvas出力はPNG Data URL、長辺4,096px、総画素数16,777,216以下、元画像を拡大しない。
- 対象はMusic Player、Apple Music、YouTube Music、Spotifyのカバー、Instagram Reelの背景とアイコン。
- `useCapture` のAPIと既存のカードDOM構造は変更しない。
- 既存の `.superpowers/` 未追跡ファイルはコミットしない。

---

### Task 1: 共通画像値とCanvas変換

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `src/shared/image-crop/image-crop.ts`
- Test: `src/shared/image-crop/image-crop.test.ts`

**Interfaces:**
- Produces `ImageMatteColor`, `EditableImage`, `createEditableImage`, `centerAspectCrop`, `percentCropToPixelCrop`, `cropImageToDataUrl`, `getEditableImageStyle`.
- `createEditableImage(displaySrc: string, originalSrc?: string | null): EditableImage` uses `originalSrc ?? null` and starts with `fit: 'cover'` and `matteColor: 'black'`.
- `EditableImage.originalSrc` is `string | null`; built-in defaults use `null` and `fit: 'cover'`, uploaded images use a Data URL.
- `cropImageToDataUrl(image, crop)` returns `Promise<string>` and rejects zero-sized crops or Canvas failures.

- [ ] **Step 1: Add the crop dependency without changing app code**

Run `npm install react-image-crop@11.1.2 --save-exact` and confirm only `package.json` and `package-lock.json` receive tracked changes.

- [ ] **Step 2: Write failing pure-function tests**

Add tests for the following behaviors:

```ts
test('初期選択を対象比率の中央に最大サイズで作る', () => {
  expect(centerAspectCrop(1600, 900, 9 / 16)).toEqual({
    unit: '%', x: 34.1796875, y: 0, width: 31.640625, height: 100,
  });
});

test('画像値の既定値は中央coverかつ黒余白', () => {
  expect(createEditableImage('default')).toEqual({
    originalSrc: null, displaySrc: 'default', fit: 'cover', matteColor: 'black',
  });
});

test('contain画像の表示スタイルに余白色を反映する', () => {
  expect(getEditableImageStyle({
    originalSrc: 'source', displaySrc: 'cropped', fit: 'contain', matteColor: 'white',
  })).toMatchObject({
    backgroundSize: 'contain', backgroundColor: '#fff', backgroundPosition: 'center',
  });
});
```

Add coordinate conversion tests for a 400x200 rendered image and a 25% x/50% y/50% width/25% height crop, plus rejection tests for zero width and zero height.

- [ ] **Step 3: Run the focused test and confirm the expected RED failure**

Run `npx vitest run src/shared/image-crop/image-crop.test.ts`. It must fail because the shared module does not exist yet.

- [ ] **Step 4: Implement the minimal shared functions**

Implement `centerAspectCrop` by fitting the requested aspect into the full image and centering the unused axis. Implement `percentCropToPixelCrop` by multiplying the percent values by rendered width and height and rounding. Implement `getEditableImageStyle` with `backgroundImage: url("<displaySrc>")`, `backgroundSize` from `fit`, centered/no-repeat positioning, and `#000`/`#fff` matte colors.

Implement `cropImageToDataUrl` as follows:

```ts
const scaleX = image.naturalWidth / image.getBoundingClientRect().width;
const scaleY = image.naturalHeight / image.getBoundingClientRect().height;
const sourceWidth = crop.width * scaleX;
const sourceHeight = crop.height * scaleY;
const outputScale = Math.min(
  1,
  4096 / Math.max(sourceWidth, sourceHeight),
  Math.sqrt(16_777_216 / (sourceWidth * sourceHeight)),
);
```

Create a canvas at the scaled output dimensions, draw the crop from the natural image, and return `canvas.toDataURL('image/png')`. Throw a Japanese-independent `Error` from the helper; the UI translates it to a Japanese message.

- [ ] **Step 5: Run the focused test and confirm GREEN**

Run `npx vitest run src/shared/image-crop/image-crop.test.ts` and then `npx tsc --noEmit`.

- [ ] **Step 6: Commit the shared crop foundation**

Run `git add package.json package-lock.json src/shared/image-crop/image-crop.ts src/shared/image-crop/image-crop.test.ts && git commit -m "feat: add shared image crop utilities"`.

### Task 2: Shared crop field and dialog

**Files:**
- Create: `src/shared/image-crop/ImageCropField.tsx`
- Create: `src/shared/image-crop/image-crop.css`
- Test: `src/shared/image-crop/ImageCropField.test.tsx`

**Interfaces:**
- `ImageCropFieldProps` consumes `id`, `label`, `value`, `targetAspect`, `onChange`, optional `helpText`, and optional `error`.
- The field emits a new `EditableImage` only after a valid file selection or clicking 完了. Cancel/Esc emits nothing.

- [ ] **Step 1: Write failing component tests**

Create a `defaultProps` helper with `id: 'in-image'`, `label: 'Cover Image'`, `value: createEditableImage('default')`, `targetAspect: 1`, and `onChange: vi.fn()`.

Cover these user-visible behaviors:

```tsx
test('未アップロード時は調整ボタンを無効にする', () => {
  render(<ImageCropField {...defaultProps} value={createEditableImage('default')} />);
  expect(screen.getByRole('button', { name: 'トリミングを調整' })).toBeDisabled();
});

test('画像選択後に調整ボタンを有効にする', async () => {
  const user = userEvent.setup();
  render(<ImageCropField {...defaultProps} />);
  await user.upload(screen.getByLabelText('Cover Image'), new File(['image'], 'cover.png', { type: 'image/png' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'トリミングを調整' })).toBeEnabled());
});

test('調整ダイアログはキャンセルで編集前の値を維持する', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const editableValue = createEditableImage('source', 'source');
  render(<ImageCropField {...defaultProps} value={editableValue} onChange={onChange} />);
  await user.click(screen.getByRole('button', { name: 'トリミングを調整' }));
  await user.click(screen.getByRole('button', { name: 'キャンセル' }));
  expect(onChange).not.toHaveBeenCalled();
});
```

Also test invalid MIME, black as the initial matte color, white selection, completed crop using a mocked image/canvas, and Esc cancellation. Keep the ReactCrop mock limited to the callback surface required to exercise the field; test real crop math in Task 1.

- [ ] **Step 2: Run the focused test and confirm RED**

Run `npx vitest run src/shared/image-crop/ImageCropField.test.tsx`. It must fail because the component does not exist.

- [ ] **Step 3: Implement the controlled file field**

Use a controlled native file input with `accept="image/*"`. Validate `file.type.startsWith('image/')`, read valid files as Data URLs, emit `createEditableImage(dataUrl, dataUrl)`, show `画像ファイルを選択してください` or `画像を読み込めませんでした` in an `aria-live` error, and clear the input value after invalid selection.

Render `トリミングを調整` disabled when `value.originalSrc === null`. Preserve the existing label and help text layout through a shared wrapper class.

- [ ] **Step 4: Implement the native dialog editor**

Use `<dialog ref>` and call `showModal()`/`close()` when available, with an `open` attribute fallback for jsdom. Handle `onCancel` by preventing the default close and restoring the pre-edit value. Store draft percent crop, completed pixel crop, matte color, preview Data URL, generating state, and dialog error locally.

Render `ReactCrop` without an `aspect` prop so the selection is free-form. On image load, use a saved crop or `centerAspectCrop(naturalWidth, naturalHeight, targetAspect)`. Set `minWidth` and `minHeight` to 32. On complete, convert the latest pixel crop to a preview PNG and update the fixed `targetAspect` preview.

Render Japanese controls: `黒`, `白`, `中央に戻す`, `キャンセル`, and `完了`. The matte buttons use `aria-pressed`; `完了` is disabled while generating, before a valid crop exists, or after a conversion error. On success emit `{ ...value, displaySrc, fit: 'contain', crop, matteColor }`, then close and return focus to the adjust button.

- [ ] **Step 5: Add shared responsive and dialog styles**

Import `react-image-crop/dist/ReactCrop.css` and add scoped shared classes for the dialog backdrop, editor layout, fixed-ratio result preview, matte controls, error text, and mobile vertical layout. Set `touch-action: none` only on the crop surface so the dialog itself remains scrollable.

- [ ] **Step 6: Run component tests and typecheck**

Run `npx vitest run src/shared/image-crop/ImageCropField.test.tsx` and `npx tsc --noEmit`.

- [ ] **Step 7: Commit the shared field**

Run `git add src/shared/image-crop/ImageCropField.tsx src/shared/image-crop/image-crop.css src/shared/image-crop/ImageCropField.test.tsx && git commit -m "feat: add image crop field dialog"`.

### Task 3: Integrate square cover generators

**Files:**
- Modify: `src/apps/music_player/MusicPlayerApp.tsx`
- Modify: `src/apps/apple_music_player/AppleMusicPlayerApp.tsx`
- Modify: `src/apps/youtube_music_player/YoutubeMusicPlayerApp.tsx`
- Modify: `src/apps/spotify_player/SpotifyPlayerApp.tsx`
- Modify: `src/apps/apps.test.tsx`

**Interfaces:**
- Each app stores `coverImage: EditableImage` for form state and stores the same `EditableImage` in its applied card state.
- Each square input renders `<ImageCropField id="in-image" label="..." targetAspect={1} ... />`.

- [ ] **Step 1: Add failing integration assertions**

Extend the existing app tests to assert that each square app renders `トリミングを調整`, and add one upload/apply test that asserts the applied cover element has `background-size: contain` and `background-color: rgb(0, 0, 0)` after completing a crop. Keep existing title, theme, YouTube, and player tests unchanged.

- [ ] **Step 2: Run the focused integration tests and confirm RED**

Run `npx vitest run src/apps/apps.test.tsx`. The new assertions must fail because the inputs are still native file inputs.

- [ ] **Step 3: Replace per-app FileReader refs with controlled image values**

Initialize default values with `createEditableImage(DEFAULT_COVER)`. Replace `uploadedImageRef` and each `handleImageChange` with `useState<EditableImage>`. In each existing `applyPreview`, copy the state value into `applied.cover` and preserve all other fields and side effects.

- [ ] **Step 4: Apply shared styles to the four cover elements**

Replace each `backgroundImage`-only style with `getEditableImageStyle(applied.cover)`, preserving each element's existing className, id, role, radius, transforms, and overlays. Remove no unrelated player behavior.

- [ ] **Step 5: Replace the four inputs with `ImageCropField`**

Use the existing labels (`Cover Image` for three apps and `Artwork` for Spotify), target aspect `1`, and preserve the existing field error area for Spotify by passing its image error through the shared field. Keep the existing panel copy and button order.

- [ ] **Step 6: Run tests and typecheck**

Run `npx vitest run src/apps/apps.test.tsx` and `npx tsc --noEmit`.

- [ ] **Step 7: Commit square-generator integration**

Run `git add src/apps/music_player/MusicPlayerApp.tsx src/apps/apple_music_player/AppleMusicPlayerApp.tsx src/apps/youtube_music_player/YoutubeMusicPlayerApp.tsx src/apps/spotify_player/SpotifyPlayerApp.tsx src/apps/apps.test.tsx && git commit -m "feat: integrate crop field into music generators"`.

### Task 4: Integrate Instagram Reel and complete verification

**Files:**
- Modify: `src/apps/instagram_reel/InstagramReelApp.tsx`
- Modify: `src/apps/instagram_reel/instagram-reel.css`
- Modify: `src/apps/apps.test.tsx`

**Interfaces:**
- `ReelContent.bg` and `ReelContent.avatar` become `EditableImage` values.
- Background uses `targetAspect={9 / 16}`; icon uses `targetAspect={1}`.

- [ ] **Step 1: Add failing Instagram assertions**

Extend the Instagram test to assert both image fields expose `トリミングを調整`, and after applying a completed background crop assert `#reel-bg` has `background-size: contain` while the card remains 9:16.

- [ ] **Step 2: Run the focused test and confirm RED**

Run `npx vitest run src/apps/apps.test.tsx`. The new Instagram assertions must fail before integration.

- [ ] **Step 3: Replace Instagram refs and apply the two aspect ratios**

Initialize `DEFAULT_CONTENT.bg` and `.avatar` with `createEditableImage`, replace the two refs with state, and copy both states in `applyPreview`. Render `getEditableImageStyle` for the background, rail icon, and avatar so the same edited icon value is used in both locations.

- [ ] **Step 4: Replace the two native inputs and update help text**

Render `ImageCropField` for `Background Image` and `Icon Image`. Keep the existing IDs and labels, pass 9:16 and 1 respectively, and change the background help text to explain that the user can adjust the range instead of claiming center-only cropping.

Add `overflow: hidden` to the avatar/audio image rules only if needed to preserve their existing rounded clipping with `contain`; do not alter unrelated Reel styling.

- [ ] **Step 5: Run the full test suite and build**

Run `npm test` and `npm run build`. Confirm Vitest, Node contract tests, TypeScript, and Vite build all pass.

- [ ] **Step 6: Perform browser smoke verification**

Run `npm run dev`, open the four cover generators and Instagram Reel, upload a non-square image, open `トリミングを調整`, drag the selection, resize it to a non-target ratio, switch black/white, complete, apply, and save. Confirm the preview has matte padding and the saved PNG uses the same crop. Stop the dev server after verification.

- [ ] **Step 7: Commit the Instagram integration and verification changes**

Run `git add src/apps/instagram_reel/InstagramReelApp.tsx src/apps/instagram_reel/instagram-reel.css src/apps/apps.test.tsx && git commit -m "feat: add free crop to reel images"`.

## Final checklist

- [ ] `npm test` passes with no tracked changes outside the feature.
- [ ] `npm run build` passes.
- [ ] All six image inputs use the shared field and preserve current defaults.
- [ ] Free-form drag/resize works with mouse and touch-capable Pointer Events.
- [ ] Black default and white optional matte are visible in preview and capture.
- [ ] No `.superpowers/` files are staged.
