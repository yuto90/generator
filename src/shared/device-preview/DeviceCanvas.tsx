import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useDevicePreview } from './DevicePreviewContext';
import { getDisplayScale, type DeviceSize } from './device-preview';
import './device-preview.css';

export interface DeviceCanvasProps {
  children: ReactNode;
  className?: string;
}

function getAvailableSize(element: HTMLElement | null): DeviceSize {
  const slot = element?.closest<HTMLElement>('[data-device-preview-slot]');
  const stage = element?.closest<HTMLElement>('[data-device-preview-stage]');
  const parent = element?.parentElement;
  const boundary = slot ?? stage ?? parent;
  const rect = boundary?.getBoundingClientRect();
  const boundaryStyle = boundary ? getComputedStyle(boundary) : null;
  const horizontalPadding = boundaryStyle
    ? (parseFloat(boundaryStyle.paddingLeft) || 0) + (parseFloat(boundaryStyle.paddingRight) || 0)
    : 0;
  const verticalPadding = boundaryStyle
    ? (parseFloat(boundaryStyle.paddingTop) || 0) + (parseFloat(boundaryStyle.paddingBottom) || 0)
    : 0;
  const toolbar = slot?.querySelector<HTMLElement>('[data-device-toolbar]')
    ?? parent?.querySelector<HTMLElement>('[data-device-toolbar]');
  const toolbarHeight = toolbar?.getBoundingClientRect().height ?? 0;
  const stack = toolbar?.parentElement;
  const stackStyle = stack ? getComputedStyle(stack) : null;
  const measuredGap = stackStyle ? parseFloat(stackStyle.rowGap || stackStyle.gap) : Number.NaN;
  const stackGap = Number.isFinite(measuredGap) && measuredGap > 0 ? measuredGap : 12;
  const width = rect?.width
    ? Math.max(1, rect.width - horizontalPadding)
    : (typeof window !== 'undefined' ? Math.max(280, window.innerWidth - 64) : 375);
  const measuredHeight = rect?.height
    ? rect.height - verticalPadding - toolbarHeight - stackGap
    : 0;
  const height = measuredHeight > 0
    ? Math.max(240, measuredHeight)
    : (typeof window !== 'undefined' ? Math.max(420, window.innerHeight - 220) : 667);
  return { width, height };
}

export function DeviceCanvas({ children, className = '' }: DeviceCanvasProps) {
  const { outputSize, setDisplayScale } = useDevicePreview();
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [available, setAvailable] = useState<DeviceSize>(() => getAvailableSize(null));

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const update = () => setAvailable(previous => {
      const next = getAvailableSize(frame);
      return previous.width === next.width && previous.height === next.height ? previous : next;
    });
    update();
    const slot = frame?.closest<HTMLElement>('[data-device-preview-slot]');
    const stage = frame?.closest<HTMLElement>('[data-device-preview-stage]');
    const observed = slot ?? stage ?? frame?.parentElement;
    const toolbar = slot?.querySelector<HTMLElement>('[data-device-toolbar]')
      ?? frame?.parentElement?.querySelector<HTMLElement>('[data-device-toolbar]');
    const observedElements = [observed, toolbar].filter((target, index, all): target is HTMLElement => Boolean(target) && all.indexOf(target) === index);
    if (typeof ResizeObserver === 'undefined' || observedElements.length === 0) {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const observer = new ResizeObserver(update);
    observedElements.forEach(target => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  const scale = getDisplayScale(outputSize, available);
  useEffect(() => {
    setDisplayScale(scale);
  }, [scale, setDisplayScale]);
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
