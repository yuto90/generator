import { useCallback, useRef, useState } from 'react';
import { snapdom } from '@zumer/snapdom';
import type { DeviceCaptureSize, DeviceSize } from '../device-preview/device-preview';

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

function isSafari() {
  return /safari/i.test(navigator.userAgent) && !/(?:chrome|chromium|android)/i.test(navigator.userAgent);
}

function readElementSize(element: HTMLElement): DeviceSize {
  const rect = element.getBoundingClientRect();
  const width = Math.round(rect.width || element.offsetWidth || parseFloat(getComputedStyle(element).width) || 1);
  const height = Math.round(rect.height || element.offsetHeight || parseFloat(getComputedStyle(element).height) || 1);
  return { width: Math.max(1, width), height: Math.max(1, height) };
}

function createCaptureTarget(element: HTMLElement, size: DeviceSize) {
  const appRoot = element.closest<HTMLElement>('[class^="app-"], [class*=" app-"]') ?? document.body;
  const captureTarget = element.cloneNode(true) as HTMLElement;

  Object.assign(captureTarget.style, {
    position: 'fixed',
    top: '0',
    left: '-100000px',
    margin: '0',
    pointerEvents: 'none',
    width: `${size.width}px`,
    height: `${size.height}px`,
    minWidth: `${size.width}px`,
    minHeight: `${size.height}px`,
    maxWidth: `${size.width}px`,
    maxHeight: `${size.height}px`,
    boxSizing: 'border-box',
    containerType: 'size',
    transform: 'none',
    transformOrigin: 'top left',
  });
  captureTarget.setAttribute('aria-hidden', 'true');
  appRoot.append(captureTarget);

  // SnapDOMはno-repeatのCSS背景を出力サイズに合わせて事前圧縮する。
  // Safariで大きなdata URLの描画が途中で欠落しないよう、保存用の複製だけ正規化する。
  const nodes = [captureTarget, ...captureTarget.querySelectorAll<HTMLElement>('*')];
  nodes.forEach((node) => {
    const style = getComputedStyle(node);
    if (/url\(/i.test(style.backgroundImage) && /(?:cover|contain)/i.test(style.backgroundSize)) {
      node.style.backgroundRepeat = 'no-repeat';
    }
  });

  return captureTarget;
}

/**
 * プレビューカードを PNG として保存する(全アプリ共通のキャプチャ処理)。
 * SnapDOM はブラウザ自身の描画(SVG foreignObject)を使うため、
 * プレビューと同一の見た目で保存できる。Safariでは画像の描画完了も確認する。
 * エラーは投げ直すので、表示方法(alert / ステータス表示)はアプリ側で決める。
 */
export function useCapture() {
  const [capturing, setCapturing] = useState(false);
  const captureLock = useRef(false);

  const capture = useCallback(async (
    element: HTMLElement | null,
    fileName: string,
    layoutSize?: DeviceSize,
    physicalSize?: DeviceCaptureSize,
  ) => {
    if (captureLock.current) return;
    captureLock.current = true;
    let captureTarget: HTMLElement | null = null;
    setCapturing(true);
    try {
      if (!element) throw new CaptureError(TARGET_ERROR);
      const size = layoutSize ?? readElementSize(element);
      const output = physicalSize ?? { ...size, dpr: 1 };
      const hasExplicitOutputSize = Boolean(layoutSize || physicalSize);
      if (document.fonts?.ready) await document.fonts.ready;
      captureTarget = createCaptureTarget(element, size);
      const captureResult = await snapdom(captureTarget, {
        format: 'png',
        filename: fileName,
        scale: 1,
        dpr: output.dpr,
        ...(hasExplicitOutputSize ? { width: output.width, height: output.height } : {}),
      });
      if (isSafari()) {
        // WebKitはforeignObject内のフォント・画像を最初のdrawImageで
        // 遅延描画するため、同じSVGを一度ラスタライズしてから保存する。
        await captureResult.toCanvas(hasExplicitOutputSize ? {
          width: output.width,
          height: output.height,
          // SnapDOM 2.23.1のdownload()は内部でdpr:1を使うため、
          // Safariの事前ラスタライズも保存PNGと同じ物理解像度へ合わせる。
          dpr: 1,
        } : undefined);
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
      }
      await captureResult.download();
    } catch (error) {
      throw normalizeCaptureError(error);
    } finally {
      captureTarget?.remove();
      setCapturing(false);
      captureLock.current = false;
    }
  }, []);

  return { capture, capturing };
}
