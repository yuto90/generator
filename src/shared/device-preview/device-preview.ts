export const DEVICE_PREVIEW_STORAGE_KEY = 'generator-device-preview';

export const DEVICE_PREVIEW_LIMITS = {
  minWidth: 320,
  maxWidth: 1440,
  minHeight: 568,
  maxHeight: 2560,
} as const;

export type DevicePreviewMode = 'device' | 'preset' | 'custom';

export interface DeviceSize {
  width: number;
  height: number;
}

export interface DevicePreset extends DeviceSize {
  id: string;
  label: string;
  /** 保存PNGの物理解像度を算出するための密度。レイアウトは論理サイズで行う。 */
  dpr?: number;
  /** 端末仕様の丸めを含む保存PNGの物理解像度。 */
  physicalSize?: DeviceSize;
}

export interface DeviceCaptureSize extends DeviceSize {
  /** SnapDOMの画像リソース圧縮・ラスタライズに使う密度。 */
  dpr: number;
}

export interface CustomDeviceSize {
  width: string;
  height: string;
}

export interface DevicePreviewSettings {
  mode: DevicePreviewMode;
  presetId: string;
  custom: CustomDeviceSize;
}

export interface CustomSizeErrors {
  width: string;
  height: string;
  orientation: string;
}

export const DEVICE_PRESETS: readonly DevicePreset[] = [
  { id: 'iphone-se', label: 'iPhone SE', width: 375, height: 667 },
  { id: 'iphone-16-pro', label: 'iPhone 16 Pro', width: 402, height: 874 },
  { id: 'iphone-16-pro-max', label: 'iPhone 16 Pro Max', width: 440, height: 956 },
  { id: 'pixel-10', label: 'Pixel 10', width: 412, height: 924, dpr: 2.625 },
  { id: 'pixel-9-pro-xl', label: 'Pixel 9 Pro XL', width: 448, height: 997, dpr: 3, physicalSize: { width: 1344, height: 2992 } },
  { id: 'pixel-10-pro-xl', label: 'Pixel 10 Pro XL', width: 448, height: 997, dpr: 3, physicalSize: { width: 1344, height: 2992 } },
  { id: 'ipad-mini', label: 'iPad Mini', width: 768, height: 1024 },
  { id: 'ipad-air', label: 'iPad Air', width: 820, height: 1180 },
  { id: 'ipad-pro', label: 'iPad Pro', width: 1024, height: 1366 },
  { id: 'galaxy-tab-s4', label: 'Galaxy Tab S4', width: 712, height: 1138 },
] as const;

export const DEFAULT_DEVICE_PREVIEW_SETTINGS: DevicePreviewSettings = {
  mode: 'device',
  presetId: DEVICE_PRESETS[0].id,
  custom: { width: '375', height: '667' },
};

function finitePositiveNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function integerSize(size: DeviceSize): DeviceSize {
  return { width: Math.max(1, Math.round(size.width)), height: Math.max(1, Math.round(size.height)) };
}

/** viewportを縦向きの整数サイズへ正規化する。入力値は入れ替えず、出力だけを縦向きにする。 */
export function normalizePortraitSize(width: number, height: number): DeviceSize {
  const normalizedWidth = finitePositiveNumber(width) ?? DEVICE_PREVIEW_LIMITS.minWidth;
  const normalizedHeight = finitePositiveNumber(height) ?? DEVICE_PREVIEW_LIMITS.minHeight;
  const size = integerSize({
    width: Math.min(normalizedWidth, normalizedHeight),
    height: Math.max(normalizedWidth, normalizedHeight),
  });
  return size;
}

/** 縦横比を保ったまま、指定サイズを出力制約へ収める。 */
export function constrainPortraitSize(input: DeviceSize): { size: DeviceSize; adjusted: boolean } {
  const source = normalizePortraitSize(input.width, input.height);
  const { minWidth, maxWidth, minHeight, maxHeight } = DEVICE_PREVIEW_LIMITS;
  const lowerScale = Math.max(minWidth / source.width, minHeight / source.height, 0);
  const upperScale = Math.min(maxWidth / source.width, maxHeight / source.height);

  // 極端な縦横比では矩形制約と同時に交差できないため、最大側を優先して
  // それでも下限を割る場合だけ最後に下限へ寄せる。通常のviewport/端末値は
  // この分岐を通らず、縦横比をそのまま保てる。
  let scale = Math.min(1, upperScale);
  if (scale < lowerScale && lowerScale <= upperScale) scale = lowerScale;
  if (scale <= 0 || !Number.isFinite(scale)) scale = 1;

  let width = Math.round(source.width * scale);
  let height = Math.round(source.height * scale);
  width = Math.min(maxWidth, Math.max(minWidth, width));
  height = Math.min(maxHeight, Math.max(minHeight, height));

  // 丸めで幅が高さを超えないようにする。実寸は常に整数で保存する。
  if (width > height) width = height;
  const size = { width, height };
  return { size, adjusted: size.width !== source.width || size.height !== source.height };
}

function parseInteger(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function validateCustomSize(custom: CustomDeviceSize): CustomSizeErrors {
  const width = parseInteger(custom.width);
  const height = parseInteger(custom.height);
  const errors: CustomSizeErrors = { width: '', height: '', orientation: '' };

  if (width === null || width < DEVICE_PREVIEW_LIMITS.minWidth || width > DEVICE_PREVIEW_LIMITS.maxWidth) {
    errors.width = `幅は${DEVICE_PREVIEW_LIMITS.minWidth}〜${DEVICE_PREVIEW_LIMITS.maxWidth}pxの整数で入力してください`;
  }
  if (height === null || height < DEVICE_PREVIEW_LIMITS.minHeight || height > DEVICE_PREVIEW_LIMITS.maxHeight) {
    errors.height = `高さは${DEVICE_PREVIEW_LIMITS.minHeight}〜${DEVICE_PREVIEW_LIMITS.maxHeight}pxの整数で入力してください`;
  }
  if (width !== null && height !== null && width <= DEVICE_PREVIEW_LIMITS.maxWidth && height <= DEVICE_PREVIEW_LIMITS.maxHeight && width > height) {
    errors.orientation = '幅は高さ以下にしてください（横向きは指定できません）';
  }
  return errors;
}

export function hasCustomSizeErrors(errors: CustomSizeErrors): boolean {
  return Boolean(errors.width || errors.height || errors.orientation);
}

export function getPreset(id: string): DevicePreset {
  return DEVICE_PRESETS.find(preset => preset.id === id) ?? DEVICE_PRESETS[0];
}

export function customSizeToDeviceSize(custom: CustomDeviceSize): DeviceSize | null {
  const errors = validateCustomSize(custom);
  if (hasCustomSizeErrors(errors)) return null;
  return { width: Number(custom.width), height: Number(custom.height) };
}

export function getEffectiveDeviceSize(
  settings: DevicePreviewSettings,
  viewport: DeviceSize,
): { size: DeviceSize; adjusted: boolean; valid: boolean; errors: CustomSizeErrors } {
  const errors = validateCustomSize(settings.custom);
  const fallbackPreset = getPreset(settings.presetId);
  const fallbackSize: DeviceSize = { width: fallbackPreset.width, height: fallbackPreset.height };
  if (settings.mode === 'custom') {
    const custom = customSizeToDeviceSize(settings.custom);
    return {
      size: custom ?? fallbackSize,
      adjusted: false,
      valid: !hasCustomSizeErrors(errors),
      errors,
    };
  }
  if (settings.mode === 'preset') {
    return { size: fallbackSize, adjusted: false, valid: true, errors };
  }
  const constrained = constrainPortraitSize(normalizePortraitSize(viewport.width, viewport.height));
  return { ...constrained, valid: true, errors };
}

function roundedPhysicalSize(size: DeviceSize, dpr: number): DeviceSize {
  return {
    width: Math.max(1, Math.round(size.width * dpr)),
    height: Math.max(1, Math.round(size.height * dpr)),
  };
}

/** プレビューの論理サイズと保存PNGの物理解像度を分離して返す。 */
export function getDeviceCaptureSize(
  settings: DevicePreviewSettings,
  viewport: DeviceSize,
): { layout: DeviceSize; physical: DeviceCaptureSize } {
  const effective = getEffectiveDeviceSize(settings, viewport);
  const preset = settings.mode === 'preset' ? getPreset(settings.presetId) : null;
  const dpr = preset?.dpr ?? 1;
  const physical = preset?.physicalSize ?? roundedPhysicalSize(effective.size, dpr);
  return {
    layout: effective.size,
    physical: { ...physical, dpr },
  };
}

export function getDisplayScale(size: DeviceSize, available: DeviceSize): number {
  if (size.width <= 0 || size.height <= 0) return 1;
  const width = available.width > 0 ? available.width : size.width;
  const height = available.height > 0 ? available.height : size.height;
  return Math.min(1, width / size.width, height / size.height);
}

function isMode(value: unknown): value is DevicePreviewMode {
  return value === 'device' || value === 'preset' || value === 'custom';
}

function isCustom(value: unknown): value is CustomDeviceSize {
  return Boolean(value && typeof value === 'object' && typeof (value as CustomDeviceSize).width === 'string' && typeof (value as CustomDeviceSize).height === 'string');
}

function getDefaultStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function parseDevicePreviewSettings(value: unknown): DevicePreviewSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_DEVICE_PREVIEW_SETTINGS, custom: { ...DEFAULT_DEVICE_PREVIEW_SETTINGS.custom } };
  const candidate = value as Partial<DevicePreviewSettings>;
  const presetId = typeof candidate.presetId === 'string' && DEVICE_PRESETS.some(preset => preset.id === candidate.presetId)
    ? candidate.presetId
    : DEFAULT_DEVICE_PREVIEW_SETTINGS.presetId;
  const hasSupportedPreset = typeof candidate.presetId === 'string' && DEVICE_PRESETS.some(preset => preset.id === candidate.presetId);
  const custom = isCustom(candidate.custom)
    ? { width: candidate.custom.width, height: candidate.custom.height }
    : { ...DEFAULT_DEVICE_PREVIEW_SETTINGS.custom };
  const mode = isMode(candidate.mode) ? candidate.mode : DEFAULT_DEVICE_PREVIEW_SETTINGS.mode;
  if (mode === 'preset' && !hasSupportedPreset) {
    return { ...DEFAULT_DEVICE_PREVIEW_SETTINGS, custom: { ...DEFAULT_DEVICE_PREVIEW_SETTINGS.custom } };
  }
  if (mode === 'custom' && hasCustomSizeErrors(validateCustomSize(custom))) {
    return { ...DEFAULT_DEVICE_PREVIEW_SETTINGS, custom: { ...DEFAULT_DEVICE_PREVIEW_SETTINGS.custom } };
  }
  return {
    mode,
    presetId,
    custom,
  };
}

export function readDevicePreviewSettings(storage: Storage | null = getDefaultStorage()): DevicePreviewSettings {
  if (!storage) return parseDevicePreviewSettings(null);
  try {
    const raw = storage.getItem(DEVICE_PREVIEW_STORAGE_KEY);
    if (!raw) return parseDevicePreviewSettings(null);
    return parseDevicePreviewSettings(JSON.parse(raw));
  } catch {
    return parseDevicePreviewSettings(null);
  }
}

export function writeDevicePreviewSettings(settings: DevicePreviewSettings, storage: Storage | null = getDefaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(DEVICE_PREVIEW_STORAGE_KEY, JSON.stringify(parseDevicePreviewSettings(settings)));
  } catch {
    // Safariのプライベートブラウズ等でlocalStorageが利用できない場合も
    // プレビュー操作自体は継続する。
  }
}
