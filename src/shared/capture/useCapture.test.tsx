import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useCapture } from './useCapture';

const download = vi.hoisted(() => vi.fn<(element: Element, options?: Record<string, unknown>) => Promise<void>>());

vi.mock('@zumer/snapdom', () => ({
  snapdom: {
    download,
  },
}));

describe('useCapture', () => {
  beforeEach(() => {
    download.mockReset();
    download.mockResolvedValue(undefined);
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: Promise.resolve() },
    });
  });

  test('PNGを4倍スケールで指定ファイル名に保存する', async () => {
    const element = document.createElement('div');
    const { result } = renderHook(() => useCapture());

    await act(async () => {
      await result.current.capture(element, 'player.png');
    });

    expect(download).toHaveBeenCalledWith(element, {
      format: 'png',
      filename: 'player.png',
      scale: 4,
    });
    expect(result.current.capturing).toBe(false);
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
});
