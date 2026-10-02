import { describe, expect, test } from 'vitest';
import {
  DEVICE_PRESETS,
  DEVICE_PREVIEW_LIMITS,
  constrainPortraitSize,
  getDeviceCaptureSize,
  getEffectiveDeviceSize,
  getDisplayScale,
  normalizePortraitSize,
  parseDevicePreviewSettings,
  validateCustomSize,
} from './device-preview';

describe('device preview size logic', () => {
  test('承認済みプリセットを論理ピクセルで定義する', () => {
    expect(DEVICE_PRESETS.map(({ label, width, height }) => ({ label, width, height }))).toEqual([
      { label: 'iPhone SE', width: 375, height: 667 },
      { label: 'iPhone 16 Pro', width: 402, height: 874 },
      { label: 'iPhone 16 Pro Max', width: 440, height: 956 },
      { label: 'Pixel 10', width: 412, height: 924 },
      { label: 'Pixel 9 Pro XL', width: 448, height: 997 },
      { label: 'Pixel 10 Pro XL', width: 448, height: 997 },
      { label: 'iPad Mini', width: 768, height: 1024 },
      { label: 'iPad Air', width: 820, height: 1180 },
      { label: 'iPad Pro', width: 1024, height: 1366 },
      { label: 'Galaxy Tab S4', width: 712, height: 1138 },
    ]);
  });

  test('viewportを縦向きへ正規化し、範囲内は維持する', () => {
    expect(normalizePortraitSize(667, 375)).toEqual({ width: 375, height: 667 });
    expect(constrainPortraitSize({ width: 375, height: 667 })).toEqual({ size: { width: 375, height: 667 }, adjusted: false });
    expect(constrainPortraitSize({ width: 1440, height: 2560 })).toEqual({ size: { width: 1440, height: 2560 }, adjusted: false });
  });

  test('範囲外の端末サイズを比率を保って調整する', () => {
    const result = constrainPortraitSize({ width: 2000, height: 3000 });
    expect(result.adjusted).toBe(true);
    expect(result.size.width / result.size.height).toBeCloseTo(2 / 3, 2);
    expect(result.size.width).toBeLessThanOrEqual(DEVICE_PREVIEW_LIMITS.maxWidth);
    expect(result.size.height).toBeLessThanOrEqual(DEVICE_PREVIEW_LIMITS.maxHeight);
  });

  test('カスタムは整数、範囲、縦向きを検証し、自動入れ替えしない', () => {
    expect(validateCustomSize({ width: '320', height: '568' })).toEqual({ width: '', height: '', orientation: '' });
    expect(validateCustomSize({ width: '320.5', height: '568' }).width).toContain('整数');
    expect(validateCustomSize({ width: '319', height: '568' }).width).toContain('320');
    expect(validateCustomSize({ width: '400', height: '300' }).orientation).toContain('横向き');
  });

  test('modeごとの実効サイズと表示縮小率を返す', () => {
    expect(getEffectiveDeviceSize({ mode: 'preset', presetId: 'ipad-pro', custom: { width: '320', height: '568' } }, { width: 320, height: 568 }).size).toEqual({ width: 1024, height: 1366 });
    expect(getEffectiveDeviceSize({ mode: 'custom', presetId: 'iphone-se', custom: { width: '320', height: '568' } }, { width: 100, height: 100 })).toMatchObject({ size: { width: 320, height: 568 }, valid: true });
    expect(getEffectiveDeviceSize({ mode: 'custom', presetId: 'iphone-se', custom: { width: '400', height: '300' } }, { width: 100, height: 100 }).valid).toBe(false);
    expect(getDisplayScale({ width: 1000, height: 2000 }, { width: 500, height: 500 })).toBe(0.25);
  });

  test('Pixel XLは論理レイアウトと物理保存サイズを分離し、1px丸めを保持する', () => {
    const result = getDeviceCaptureSize({ mode: 'preset', presetId: 'pixel-10-pro-xl', custom: { width: '320', height: '568' } }, { width: 390, height: 844 });
    expect(result.layout).toEqual({ width: 448, height: 997 });
    expect(result.physical).toEqual({ width: 1344, height: 2992, dpr: 3 });

    const pixel10 = getDeviceCaptureSize({ mode: 'preset', presetId: 'pixel-10', custom: { width: '320', height: '568' } }, { width: 390, height: 844 });
    expect(pixel10.layout).toEqual({ width: 412, height: 924 });
    expect(pixel10.physical).toEqual({ width: 412, height: 924, dpr: 1 });
    const custom = getDeviceCaptureSize({ mode: 'custom', presetId: 'pixel-10-pro-xl', custom: { width: '320', height: '568' } }, { width: 390, height: 844 });
    expect(custom.physical).toEqual({ width: 320, height: 568, dpr: 1 });
  });

  test('不正な永続化値は安全な初期値へ復旧する', () => {
    expect(parseDevicePreviewSettings({ mode: 'unknown', presetId: 'unknown', custom: { width: 1, height: 2 } })).toEqual({
      mode: 'device',
      presetId: 'iphone-se',
      custom: { width: '375', height: '667' },
    });
    expect(parseDevicePreviewSettings({ mode: 'custom', custom: { width: '横', height: '568' } })).toEqual({
      mode: 'device',
      presetId: 'iphone-se',
      custom: { width: '375', height: '667' },
    });
  });

  test('未対応または欠落したプリセットをactive modeから安全に復旧する', () => {
    const expected = {
      mode: 'device' as const,
      presetId: 'iphone-se',
      custom: { width: '375', height: '667' },
    };
    expect(parseDevicePreviewSettings({ mode: 'preset', presetId: 'retired-device', custom: { width: '320', height: '568' } })).toEqual(expected);
    expect(parseDevicePreviewSettings({ mode: 'preset', custom: { width: '320', height: '568' } })).toEqual(expected);
  });

  test('active modeでない不正presetIdは既存設定を維持する', () => {
    expect(parseDevicePreviewSettings({ mode: 'custom', presetId: 'retired-device', custom: { width: '320', height: '568' } })).toEqual({
      mode: 'custom',
      presetId: 'iphone-se',
      custom: { width: '320', height: '568' },
    });
  });
});
