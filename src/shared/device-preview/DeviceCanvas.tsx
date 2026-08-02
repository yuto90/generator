import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useDevicePreview } from './DevicePreviewContext';
import { getDisplayScale, type DeviceSize } from './device-preview';
import './device-preview.css';

export interface DeviceCanvasProps {
  children: ReactNode;
  className?: string;
}

function getAvailableSize(element: HTMLElement | null): DeviceSize {
  const parent = element?.parentElement;
  const rect = parent?.getBoundingClientRect();
  const width = rect?.width || (typeof window !== 'undefined' ? Math.max(280, window.innerWidth - 64) : 375);
  const height = rect?.height || (typeof window !== 'undefined' ? Math.max(420, window.innerHeight - 220) : 667);
  return { width, height };
}

export function DeviceCanvas({ children, className = '' }: DeviceCanvasProps) {
  const { outputSize } = useDevicePreview();
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [available, setAvailable] = useState<DeviceSize>(() => getAvailableSize(null));

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const update = () => setAvailable(previous => {
      const next = getAvailableSize(frame);
      return previous.width === next.width && previous.height === next.height ? previous : next;
    });
    update();
    const parent = frame?.parentElement;
    if (typeof ResizeObserver === 'undefined' || !parent) {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  const scale = getDisplayScale(outputSize, available);
  const frameStyle = { width: `${outputSize.width * scale}px`, height: `${outputSize.height * scale}px` };
  const canvasStyle = {
    width: `${outputSize.width}px`,
    height: `${outputSize.height}px`,
    transform: `scale(${scale})`,
    '--device-preview-width': `${outputSize.width}px`,
    '--device-preview-height': `${outputSize.height}px`,
  } as CSSProperties;

  return (
    <div className={`device-canvas-frame ${className}`} ref={frameRef} style={frameStyle} data-display-scale={scale}>
      <div className="device-canvas" style={canvasStyle} data-device-canvas data-output-width={outputSize.width} data-output-height={outputSize.height}>
        <div className="device-canvas__content">{children}</div>
      </div>
    </div>
  );
}
