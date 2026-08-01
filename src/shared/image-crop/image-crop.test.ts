import { describe, expect, test, vi } from 'vitest';
import {
  centerAspectCrop,
  cropImageToDataUrl,
  createEditableImage,
  getEditableImageStyle,
  percentCropToPixelCrop,
  type PercentCrop,
} from './image-crop';

describe('image crop utilities', () => {
  test('初期選択を対象比率の中央に最大サイズで作る', () => {
    expect(centerAspectCrop(1600, 900, 9 / 16)).toEqual({
      unit: '%',
      x: 34.1796875,
      y: 0,
      width: 31.640625,
      height: 100,
    });
  });

  test('画像値の既定値は中央coverかつ黒余白', () => {
    expect(createEditableImage('default')).toEqual({
      originalSrc: null,
      displaySrc: 'default',
      fit: 'cover',
      matteColor: 'black',
    });
  });

  test('contain画像の表示スタイルに余白色を反映する', () => {
    expect(getEditableImageStyle({
      originalSrc: 'source',
      displaySrc: 'cropped',
      fit: 'contain',
      matteColor: 'white',
    })).toMatchObject({
      backgroundSize: 'contain',
      backgroundColor: '#fff',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    });
  });

  test('パーセントの選択範囲を表示ピクセルへ変換する', () => {
    const crop: PercentCrop = { unit: '%', x: 25, y: 50, width: 50, height: 25 };
    expect(percentCropToPixelCrop(crop, 400, 200)).toEqual({
      unit: 'px',
      x: 100,
      y: 100,
      width: 200,
      height: 50,
    });
  });

  test('無効な比率や画像サイズでは中央選択を安全に返す', () => {
    expect(centerAspectCrop(0, 900, 1)).toEqual({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
    expect(centerAspectCrop(1600, 900, 0)).toEqual({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
  });

  test('Canvas出力は長辺4096pxを上限に元画像を拡大しない', async () => {
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toDataURL: vi.fn(() => 'data:image/png;base64,cropped'),
    } as unknown as HTMLCanvasElement;
    const createElement = vi.spyOn(document, 'createElement');
    createElement.mockImplementation((tagName: string) => {
      if (tagName === 'canvas') return canvas;
      return document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
    });
    const image = {
      naturalWidth: 8000,
      naturalHeight: 4000,
      width: 800,
      height: 400,
      getBoundingClientRect: () => ({ width: 800, height: 400 }),
    } as unknown as HTMLImageElement;

    await expect(cropImageToDataUrl(image, { unit: 'px', x: 0, y: 0, width: 800, height: 400 }))
      .resolves.toBe('data:image/png;base64,cropped');
    expect(canvas.width).toBe(4096);
    expect(canvas.height).toBe(2048);
    expect(drawImage).toHaveBeenCalledOnce();
    createElement.mockRestore();
  });

  test('空の選択範囲はCanvas変換前に拒否する', async () => {
    const image = { naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement;
    await expect(cropImageToDataUrl(image, { unit: 'px', x: 0, y: 0, width: 0, height: 20 }))
      .rejects.toThrow('Invalid image crop');
  });
});
