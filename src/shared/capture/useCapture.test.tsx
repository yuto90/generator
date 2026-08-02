import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useCapture } from './useCapture';

const captureSnap = vi.hoisted(() => vi.fn());
const warmUp = vi.hoisted(() => vi.fn<() => Promise<HTMLCanvasElement>>());
const download = vi.hoisted(() => vi.fn<() => Promise<void>>());

vi.mock('@zumer/snapdom', () => ({
  snapdom: captureSnap,
}));

describe('useCapture', () => {
  beforeEach(() => {
    download.mockReset();
    download.mockResolvedValue(undefined);
    warmUp.mockReset();
    warmUp.mockResolvedValue(document.createElement('canvas'));
    captureSnap.mockReset();
    captureSnap.mockResolvedValue({ toCanvas: warmUp, download });
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
    });
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: Promise.resolve() },
    });
  });

  test('Safariでも指定実寸の非表示複製をscale:1/dpr:1でPNG保存する', async () => {
    const appRoot = document.createElement('div');
    appRoot.className = 'app-test';
    const element = document.createElement('div');
    const artwork = document.createElement('div');
    artwork.style.backgroundImage = 'url("data:image/png;base64,AAAA")';
    artwork.style.backgroundSize = 'cover';
    element.append(artwork);
    appRoot.append(element);
    document.body.append(appRoot);
    captureSnap.mockImplementation(async (captureTarget: Element, options: Record<string, unknown>) => {
      expect(captureTarget).not.toBe(element);
      expect(captureTarget.parentElement).toBe(appRoot);
      expect((captureTarget as HTMLElement).style.transform).toBe('none');
      expect((captureTarget as HTMLElement).style.transformOrigin).toBe('top left');
      expect((captureTarget as HTMLElement).style.width).toBe('375px');
      expect((captureTarget as HTMLElement).style.height).toBe('667px');
      expect((captureTarget as HTMLElement).style.containerType).toBe('size');
      const captureArtwork = captureTarget.firstElementChild as HTMLElement;
      expect(captureArtwork.style.backgroundRepeat).toBe('no-repeat');
      expect(options).toEqual({
        format: 'png',
        filename: 'player.png',
        scale: 1,
        dpr: 1,
        width: 375,
        height: 667,
      });
      return { toCanvas: warmUp, download };
    });
    const { result } = renderHook(() => useCapture());

    await act(async () => {
      await result.current.capture(element, 'player.png', { width: 375, height: 667 });
    });

    expect(captureSnap).toHaveBeenCalledOnce();
    expect(warmUp).toHaveBeenCalledOnce();
    expect(download).toHaveBeenCalledOnce();
    expect(warmUp.mock.invocationCallOrder[0]).toBeLessThan(download.mock.invocationCallOrder[0]);
    expect(appRoot.children).toHaveLength(1);
    expect(element.style.transform).toBe('');
    expect(result.current.capturing).toBe(false);
    appRoot.remove();
  });

  test('保存用複製はカードの論理サイズ変数とsize container条件を引き継ぐ', async () => {
    const appRoot = document.createElement('div');
    appRoot.className = 'app-test';
    const element = document.createElement('div');
    element.id = 'player-card';
    element.style.containerType = 'size';
    element.style.setProperty('--device-preview-width', '568px');
    element.style.setProperty('--device-preview-height', '568px');
    appRoot.append(element);
    document.body.append(appRoot);
    captureSnap.mockImplementation(async (captureTarget: Element) => {
      expect((captureTarget as HTMLElement).style.containerType).toBe('size');
      expect((captureTarget as HTMLElement).style.getPropertyValue('--device-preview-width')).toBe('568px');
      expect((captureTarget as HTMLElement).style.getPropertyValue('--device-preview-height')).toBe('568px');
      return { toCanvas: warmUp, download };
    });
    const { result } = renderHook(() => useCapture());

    await act(async () => {
      await result.current.capture(element, 'player.png', { width: 568, height: 568 });
    });

    expect(captureSnap).toHaveBeenCalledOnce();
    expect(appRoot.children).toHaveLength(1);
    appRoot.remove();
  });

  test('保存処理中はcapturingがtrueになり、完了後に戻る', async () => {
    let resolveDownload!: () => void;
    download.mockReturnValue(new Promise<void>(resolve => { resolveDownload = resolve; }));
    const { result } = renderHook(() => useCapture());
    let capturePromise!: Promise<void>;
    act(() => {
      capturePromise = result.current.capture(document.createElement('div'), 'player.png');
    });

    await waitFor(() => expect(result.current.capturing).toBe(true));
    resolveDownload();
    await act(async () => { await capturePromise; });

    expect(result.current.capturing).toBe(false);
  });

  test('Chromeでは事前ラスタライズをせず直接ダウンロードする', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 Chrome/138.0.0.0 Safari/537.36',
    });
    const { result } = renderHook(() => useCapture());

    await act(async () => {
      await result.current.capture(document.createElement('div'), 'player.png');
    });

    expect(warmUp).not.toHaveBeenCalled();
    expect(download).toHaveBeenCalledOnce();
  });

  test('保存中の二重実行は1回のSnapDOMとダウンロードに抑える', async () => {
    let resolveDownload!: () => void;
    download.mockReturnValue(new Promise<void>(resolve => { resolveDownload = resolve; }));
    const { result } = renderHook(() => useCapture());
    let first!: Promise<void | undefined>;
    let second!: Promise<void | undefined>;
    act(() => {
      first = result.current.capture(document.createElement('div'), 'first.png', { width: 375, height: 667 });
      second = result.current.capture(document.createElement('div'), 'second.png', { width: 375, height: 667 });
    });
    await waitFor(() => expect(result.current.capturing).toBe(true));
    resolveDownload();
    await act(async () => { await Promise.all([first, second]); });
    expect(captureSnap).toHaveBeenCalledOnce();
    expect(download).toHaveBeenCalledOnce();
  });

  test('保存対象がない場合は利用者向けエラーに変換する', async () => {
    const { result } = renderHook(() => useCapture());

    await act(async () => {
      await expect(result.current.capture(null, 'player.png')).rejects.toMatchObject({
        message: '保存対象が見つかりませんでした。ページを再読み込みして、もう一度お試しください。',
      });
    });
    expect(download).not.toHaveBeenCalled();
    expect(result.current.capturing).toBe(false);
  });

  test('画像描画エラーは画像の再選択を案内し、元エラーをcauseに保持する', async () => {
    const originalError = new DOMException('decode failed', 'EncodingError');
    download.mockRejectedValue(originalError);
    const { result } = renderHook(() => useCapture());

    await act(async () => {
      await expect(result.current.capture(document.createElement('div'), 'player.png')).rejects.toMatchObject({
        message: '画像を読み込めませんでした。画像を選び直して、もう一度お試しください。',
        cause: originalError,
      });
    });
    expect(result.current.capturing).toBe(false);
  });

  test('一般的な生成エラーは再読み込みを案内し、元エラーをcauseに保持する', async () => {
    const originalError = new Error('renderer failed');
    download.mockRejectedValue(originalError);
    const { result } = renderHook(() => useCapture());

    await act(async () => {
      await expect(result.current.capture(document.createElement('div'), 'player.png')).rejects.toMatchObject({
        message: '画像を生成できませんでした。ページを再読み込みして、もう一度お試しください。',
        cause: originalError,
      });
    });
    expect(result.current.capturing).toBe(false);
  });

  test('SnapDOM失敗時も保存用複製を後始末する', async () => {
    const appRoot = document.createElement('div');
    appRoot.className = 'app-test';
    const element = document.createElement('div');
    appRoot.append(element);
    document.body.append(appRoot);
    const originalError = new Error('renderer failed');
    captureSnap.mockRejectedValueOnce(originalError);
    const { result } = renderHook(() => useCapture());

    await act(async () => {
      await expect(result.current.capture(element, 'player.png', { width: 375, height: 667 })).rejects.toMatchObject({ cause: originalError });
    });
    expect(appRoot.children).toHaveLength(1);
    expect(result.current.capturing).toBe(false);
    appRoot.remove();
  });
});
