import { useCallback, useState } from 'react';
import { toPng } from 'html-to-image';

/**
 * プレビューカードを PNG として保存する(全アプリ共通のキャプチャ処理)。
 * html-to-image はブラウザ自身の描画(SVG foreignObject)を使うため、
 * プレビューと同一の見た目で保存できる。
 * エラーは投げ直すので、表示方法(alert / ステータス表示)はアプリ側で決める。
 */
export function useCapture() {
  const [capturing, setCapturing] = useState(false);

  const capture = useCallback(async (element: HTMLElement, fileName: string) => {
    setCapturing(true);
    try {
      await document.fonts.ready;
      const dataUrl = await toPng(element, { pixelRatio: 4, cacheBust: true });
      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      link.click();
    } finally {
      setCapturing(false);
    }
  }, []);

  return { capture, capturing };
}
