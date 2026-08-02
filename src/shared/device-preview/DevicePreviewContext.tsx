import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_DEVICE_PREVIEW_SETTINGS,
  getEffectiveDeviceSize,
  readDevicePreviewSettings,
  type CustomDeviceSize,
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
  const visualViewport = window.visualViewport;
  return {
    width: visualViewport?.width || window.innerWidth || 375,
    height: visualViewport?.height || window.innerHeight || 667,
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
    window.visualViewport?.addEventListener('resize', updateViewport);
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
      window.visualViewport?.removeEventListener('resize', updateViewport);
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
  const value = useMemo<DevicePreviewContextValue>(() => ({
    settings,
    viewport,
    outputSize: effective.size,
    adjusted: effective.adjusted,
    valid: effective.valid,
    customErrors: effective.errors,
    displayScale,
    setMode,
    setPreset,
    setCustom,
    setDisplayScale,
  }), [displayScale, effective, settings, setCustom, setDisplayScale, setMode, setPreset, viewport]);

  return <DevicePreviewContext.Provider value={value}>{children}</DevicePreviewContext.Provider>;
}

export function useDevicePreview(): DevicePreviewContextValue {
  const value = useContext(DevicePreviewContext);
  if (!value) throw new Error('useDevicePreviewはDevicePreviewProvider内で使用してください');
  return value;
}

export { DEFAULT_DEVICE_PREVIEW_SETTINGS };
