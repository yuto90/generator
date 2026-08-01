import { useEffect, useRef, useState, type ChangeEvent, type SyntheticEvent } from 'react';
import ReactCrop, { type PercentCrop, type PixelCrop } from 'react-image-crop';
import {
  centerAspectCrop,
  cropImageToDataUrl,
  createEditableImage,
  fitCropToAspect,
  getEditableImageStyle,
  percentCropToPixelCrop,
  type EditableImage,
  type ImageMatteColor,
} from './image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import './image-crop.css';

export interface ImageCropFieldProps {
  id: string;
  label: string;
  value: EditableImage;
  targetAspect: number;
  onChange: (value: EditableImage) => void;
  helpText?: string;
  error?: string;
}

function renderedSize(image: HTMLImageElement): { width: number; height: number } {
  const bounds = image.getBoundingClientRect();
  return {
    width: bounds.width || image.width || image.naturalWidth,
    height: bounds.height || image.height || image.naturalHeight,
  };
}

export default function ImageCropField({
  id,
  label,
  value,
  targetAspect,
  onChange,
  helpText,
  error,
}: ImageCropFieldProps) {
  const [inputError, setInputError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftCrop, setDraftCrop] = useState<PercentCrop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [draftAspectLocked, setDraftAspectLocked] = useState(value.cropAspectLocked ?? false);
  const [draftMatte, setDraftMatte] = useState<ImageMatteColor>(value.matteColor);
  const [previewSrc, setPreviewSrc] = useState(value.displaySrc);
  const [generating, setGenerating] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const adjustButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (dialogOpen) {
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
      }
      return;
    }

    if (dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [dialogOpen]);

  function openEditor() {
    if (!value.originalSrc) return;
    setDraftCrop(value.crop);
    setCompletedCrop(undefined);
    setDraftAspectLocked(value.cropAspectLocked ?? false);
    setDraftMatte(value.matteColor);
    setPreviewSrc(value.displaySrc);
    setDialogError('');
    setGenerating(false);
    setDialogOpen(true);
  }

  function closeEditor() {
    setDialogOpen(false);
    window.setTimeout(() => adjustButtonRef.current?.focus(), 0);
  }

  function cancelEditor() {
    setDialogError('');
    setGenerating(false);
    closeEditor();
  }

  function handleDialogCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    cancelEditor();
  }

  async function updatePreview(image: HTMLImageElement, crop: PixelCrop) {
    setGenerating(true);
    setDialogError('');
    try {
      const nextPreview = await cropImageToDataUrl(image, crop);
      setPreviewSrc(nextPreview);
      return nextPreview;
    } catch {
      setDialogError('画像を切り抜けませんでした');
      return null;
    } finally {
      setGenerating(false);
    }
  }

  function handleImageLoad(event: SyntheticEvent<HTMLImageElement>) {
    const image = event.currentTarget;
    imageRef.current = image;
    const size = renderedSize(image);
    if (size.width <= 0 || size.height <= 0) {
      setDialogError('画像のサイズを取得できませんでした');
      return;
    }

    const initialCrop = draftCrop ?? centerAspectCrop(image.naturalWidth, image.naturalHeight, targetAspect);
    const nextCrop = draftAspectLocked
      ? fitCropToAspect(initialCrop, size.width, size.height, targetAspect)
      : initialCrop;
    setDraftCrop(nextCrop);
    const pixelCrop = percentCropToPixelCrop(nextCrop, size.width, size.height);
    setCompletedCrop(pixelCrop);
    void updatePreview(image, pixelCrop);
  }

  function handleCropChange(_pixelCrop: PixelCrop, percentCrop: PercentCrop) {
    setDraftCrop(percentCrop);
  }

  function handleCropComplete(pixelCrop: PixelCrop, percentCrop: PercentCrop) {
    setDraftCrop(percentCrop);
    setCompletedCrop(pixelCrop);
    if (imageRef.current) void updatePreview(imageRef.current, pixelCrop);
  }

  function handleAspectLockToggle() {
    const nextLocked = !draftAspectLocked;
    setDraftAspectLocked(nextLocked);
    if (!nextLocked || !imageRef.current) return;

    const image = imageRef.current;
    const size = renderedSize(image);
    if (size.width <= 0 || size.height <= 0) return;

    const initialCrop = draftCrop ?? centerAspectCrop(
      image.naturalWidth || size.width,
      image.naturalHeight || size.height,
      targetAspect,
    );
    const nextCrop = fitCropToAspect(initialCrop, size.width, size.height, targetAspect);
    const pixelCrop = percentCropToPixelCrop(nextCrop, size.width, size.height);
    setDraftCrop(nextCrop);
    setCompletedCrop(pixelCrop);
    void updatePreview(image, pixelCrop);
  }

  function resetCrop() {
    const image = imageRef.current;
    if (!image) return;
    const size = renderedSize(image);
    const nextCrop = centerAspectCrop(image.naturalWidth, image.naturalHeight, targetAspect);
    const pixelCrop = percentCropToPixelCrop(nextCrop, size.width, size.height);
    setDraftCrop(nextCrop);
    setCompletedCrop(pixelCrop);
    void updatePreview(image, pixelCrop);
  }

  async function applyCrop() {
    const image = imageRef.current;
    const source = value.originalSrc;
    if (!image || !source || !completedCrop || completedCrop.width <= 0 || completedCrop.height <= 0 || generating) return;

    setGenerating(true);
    setDialogError('');
    try {
      const displaySrc = await cropImageToDataUrl(image, completedCrop);
      onChange({
        ...value,
        originalSrc: source,
        displaySrc,
        fit: draftAspectLocked ? 'cover' : 'contain',
        crop: draftCrop,
        cropAspectLocked: draftAspectLocked,
        matteColor: draftMatte,
      });
      closeEditor();
    } catch {
      setDialogError('画像を切り抜けませんでした');
    } finally {
      setGenerating(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setInputError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setInputError('画像ファイルを選択してください');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      onChange(createEditableImage(src, src));
    };
    reader.onerror = () => {
      setInputError('画像を読み込めませんでした');
      event.target.value = '';
    };
    reader.readAsDataURL(file);
  }

  const currentError = inputError || error || dialogError;
  const previewImage: EditableImage = {
    ...value,
    displaySrc: previewSrc,
    fit: draftAspectLocked ? 'cover' : 'contain',
    matteColor: draftMatte,
  };

  return (
    <div className="image-crop-field">
      <label className="image-crop-field__label" htmlFor={id}>{label}</label>
      <input
        className="file-input image-crop-field__input"
        id={id}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
      />
      <div className="image-crop-field__actions">
        <button
          ref={adjustButtonRef}
          className="image-crop-field__adjust"
          type="button"
          onClick={openEditor}
          disabled={!value.originalSrc}
        >
          トリミングを調整
        </button>
        {value.fit === 'contain' && <span className="image-crop-field__status">調整済み</span>}
      </div>
      {helpText && <p className="image-crop-field__help">{helpText}</p>}
      <p className="image-crop-field__error" role="alert" aria-live="polite">{currentError}</p>

      <dialog
        ref={dialogRef}
        className="image-crop-dialog"
        aria-labelledby={`${id}-crop-title`}
        onCancel={handleDialogCancel}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.preventDefault();
            cancelEditor();
          }
        }}
      >
        <div className="image-crop-dialog__header">
          <h2 id={`${id}-crop-title`}>トリミングを調整</h2>
          <button type="button" className="image-crop-dialog__close" aria-label="閉じる" onClick={cancelEditor}>×</button>
        </div>

        <div className="image-crop-dialog__body">
          <div className="image-crop-dialog__editor">
            <div className="image-crop-dialog__crop-surface">
              {value.originalSrc && (
                <ReactCrop
                  crop={draftCrop}
                  aspect={draftAspectLocked ? targetAspect : undefined}
                  minWidth={32}
                  minHeight={32}
                  keepSelection
                  onChange={handleCropChange}
                  onComplete={handleCropComplete}
                >
                  <img src={value.originalSrc} alt={`${label}のトリミング対象`} onLoad={handleImageLoad} />
                </ReactCrop>
              )}
            </div>
            <p className="image-crop-dialog__hint">枠の内部・辺・四隅をドラッグして範囲を調整できます</p>
          </div>

          <div className="image-crop-dialog__preview-wrap">
            <p className="image-crop-dialog__section-label">プレビュー</p>
            <div
              className="image-crop-dialog__preview"
              style={{ ...getEditableImageStyle(previewImage), aspectRatio: String(targetAspect) }}
              aria-label="トリミング結果"
            />
          </div>
        </div>

        <fieldset className="image-crop-dialog__aspect-mode">
          <legend>表示比率</legend>
          <button
            type="button"
            aria-pressed={draftAspectLocked}
            className={draftAspectLocked ? 'is-selected' : ''}
            onClick={handleAspectLockToggle}
          >
            枠いっぱいにする
          </button>
          {draftAspectLocked && <span className="image-crop-dialog__aspect-status">プレビュー枠と同じ比率で固定中</span>}
        </fieldset>

        <fieldset className="image-crop-dialog__matte">
          <legend>余白の色</legend>
          <button type="button" aria-pressed={draftMatte === 'black'} className={draftMatte === 'black' ? 'is-selected' : ''} onClick={() => setDraftMatte('black')}>黒</button>
          <button type="button" aria-pressed={draftMatte === 'white'} className={draftMatte === 'white' ? 'is-selected' : ''} onClick={() => setDraftMatte('white')}>白</button>
        </fieldset>

        {dialogError && <p className="image-crop-dialog__error" role="alert">{dialogError}</p>}
        <div className="image-crop-dialog__actions">
          <button type="button" className="image-crop-dialog__reset" onClick={resetCrop} disabled={!imageRef.current || generating}>中央に戻す</button>
          <button type="button" className="image-crop-dialog__cancel" onClick={cancelEditor}>キャンセル</button>
          <button type="button" className="image-crop-dialog__complete" onClick={applyCrop} disabled={!completedCrop || generating || Boolean(dialogError)}>完了</button>
        </div>
      </dialog>
    </div>
  );
}
