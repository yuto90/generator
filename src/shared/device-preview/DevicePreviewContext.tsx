import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_DEVICE_PREVIEW_SETTINGS,
  getDeviceCaptureSize,
  getEffectiveDeviceSize,
  readDevicePreviewSettings,
  type CustomDeviceSize,
  type DeviceCaptureSize,
  type DevicePreviewMode,
  type DevicePreviewSettings,
  type DeviceSize,
  type CustomSizeErrors,
  writeDevicePreviewSettings,
} from './device-preview';

interface DevicePreviewContextValue {
  settings: DevicePreviewSettings;
  viewport: DeviceSize;
  outputSize: DeviceSize;
  /** 保存PNGの物理解像度。プレビューの論理サイズとは別に扱う。 */
  captureSize: DeviceCaptureSize;
  adjusted: boolean;
  valid: boolean;
  customErrors: CustomSizeErrors;
  displayScale: number;
  setMode: (mode: DevicePreviewMode) => void;
  setPreset: (presetId: string) => void;
  setCustom: (custom: CustomDeviceSize) => void;
  setDisplayScale: (scale: number) => void;
}

const DevicePreviewContext = createContext<DevicePreviewContextValue | null>(null);

function getViewport(): DeviceSize {
  if (typeof window === 'undefined') return { width: 375, height: 667 };
  const layoutViewport = window.document.documentElement;
  return {
    // visualViewportはアドレスバー・キーボード・ピンチズームで変動するため、
    // 「この端末」の保存サイズにはレイアウトviewportだけを使う。
    width: layoutViewport?.clientWidth || window.innerWidth || 375,
    height: layoutViewport?.clientHeight || window.innerHeight || 667,
  };
}

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function sameSize(left: DeviceSize, right: DeviceSize) {
  return left.width === right.width && left.height === right.height;
}

export interface DevicePreviewProviderProps {
  children: ReactNode;
  storage?: Storage | null;
}

export function DevicePreviewProvider({ children, storage }: DevicePreviewProviderProps) {
  const storageTarget = storage === undefined ? getBrowserStorage() : storage;
  const [settings, setSettings] = useState<DevicePreviewSettings>(() => readDevicePreviewSettings(storageTarget));
  const [viewport, setViewport] = useState<DeviceSize>(() => getViewport());
  const [displayScale, setDisplayScaleState] = useState(1);

  useEffect(() => {
    const updateViewport = () => {
      const next = getViewport();
      setViewport(previous => sameSize(previous, next) ? previous : next);
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
    };
  }, []);

  useEffect(() => {
    writeDevicePreviewSettings(settings, storageTarget);
  }, [settings, storageTarget]);

  const setMode = useCallback((mode: DevicePreviewMode) => {
    setSettings(previous => ({ ...previous, mode }));
  }, []);
  const setPreset = useCallback((presetId: string) => {
    setSettings(previous => ({ ...previous, mode: 'preset', presetId }));
  }, []);
  const setCustom = useCallback((custom: CustomDeviceSize) => {
    setSettings(previous => ({ ...previous, mode: 'custom', custom }));
  }, []);
  const setDisplayScale = useCallback((scale: number) => {
    const next = Number.isFinite(scale) && scale > 0 ? Math.min(1, scale) : 1;
    setDisplayScaleState(previous => previous === next ? previous : next);
  }, []);

  const effective = useMemo(() => getEffectiveDeviceSize(settings, viewport), [settings, viewport]);
  const capture = useMemo(() => getDeviceCaptureSize(settings, viewport), [settings, viewport]);
  const value = useMemo<DevicePreviewContextValue>(() => ({
    settings,
    viewport,
    outputSize: effective.size,
    captureSize: capture.physical,
    adjusted: effective.adjusted,
    valid: effective.valid,
    customErrors: effective.errors,
    displayScale,
    setMode,
    setPreset,
    setCustom,
    setDisplayScale,
  }), [capture.physical, displayScale, effective, settings, setCustom, setDisplayScale, setMode, setPreset, viewport]);

  return <DevicePreviewContext.Provider value={value}>{children}</DevicePreviewContext.Provider>;
}

export function useDevicePreview(): DevicePreviewContextValue {
  const value = useContext(DevicePreviewContext);
  if (!value) throw new Error('useDevicePreviewはDevicePreviewProvider内で使用してください');
  return value;
}

export { DEFAULT_DEVICE_PREVIEW_SETTINGS };
