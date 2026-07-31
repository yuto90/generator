import { useCallback, useState } from 'react';
import { snapdom } from '@zumer/snapdom';

const TARGET_ERROR = '保存対象が見つかりませんでした。ページを再読み込みして、もう一度お試しください。';
const IMAGE_ERROR = '画像を読み込めませんでした。画像を選び直して、もう一度お試しください。';
const GENERIC_ERROR = '画像を生成できませんでした。ページを再読み込みして、もう一度お試しください。';

export class CaptureError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'CaptureError';
  }
}

function isImageRenderError(error: unknown) {
  const details = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /canvas|decode|encoding|image|load|resource|security|svg/i.test(details);
}

function normalizeCaptureError(error: unknown) {
  if (error instanceof CaptureError) return error;
  return new CaptureError(isImageRenderError(error) ? IMAGE_ERROR : GENERIC_ERROR, error);
}

/**
 * プレビューカードを PNG として保存する(全アプリ共通のキャプチャ処理)。
 * SnapDOM はブラウザ自身の描画(SVG foreignObject)を使うため、
 * プレビューと同一の見た目で保存できる。Safariでは画像の描画完了も確認する。
 * エラーは投げ直すので、表示方法(alert / ステータス表示)はアプリ側で決める。
 */
export function useCapture() {
  const [capturing, setCapturing] = useState(false);

  const capture = useCallback(async (element: HTMLElement | null, fileName: string) => {
    setCapturing(true);
    try {
      if (!element) throw new CaptureError(TARGET_ERROR);
      if (document.fonts?.ready) await document.fonts.ready;
      await snapdom.download(element, {
        format: 'png',
        filename: fileName,
        scale: 4,
      });
    } catch (error) {
      throw normalizeCaptureError(error);
    } finally {
      setCapturing(false);
    }
  }, []);

  return { capture, capturing };
}
