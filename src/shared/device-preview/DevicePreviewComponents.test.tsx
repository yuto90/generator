import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';
import { DeviceCanvas } from './DeviceCanvas';
import { DevicePreviewProvider } from './DevicePreviewContext';
import { DeviceToolbar } from './DeviceToolbar';

function Preview() {
  return (
    <DevicePreviewProvider>
      <DeviceToolbar />
      <DeviceCanvas><div data-testid="content">プレビュー</div></DeviceCanvas>
    </DevicePreviewProvider>
  );
}

function StableStagePreview() {
  return (
    <DevicePreviewProvider>
      <div data-device-preview-stage>
        <DeviceToolbar />
        <DeviceCanvas><div data-testid="stable-content">プレビュー</div></DeviceCanvas>
      </div>
    </DevicePreviewProvider>
  );
}

function SlotPreview() {
  return (
    <DevicePreviewProvider>
      <div data-device-preview-stage>
        <div data-device-preview-slot>
          <DeviceToolbar />
          <DeviceCanvas><div data-testid="slot-content">プレビュー</div></DeviceCanvas>
        </div>
      </div>
    </DevicePreviewProvider>
  );
}

describe('DeviceToolbar / DeviceCanvas', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
  });

  test('3種類のモードをキーボードで切り替え、サイズと縮小率を通知する', () => {
    render(<Preview />);
    expect(screen.getByRole('tab', { name: 'この端末' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/出力サイズ 390×844px/)).toBeInTheDocument();
    expect(screen.getByText(/表示倍率/)).toBeInTheDocument();
    act(() => {
      screen.getByRole('tab', { name: 'この端末' }).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(screen.getByRole('tab', { name: '端末プリセット' })).toHaveAttribute('aria-selected', 'true');
  });

  test('カスタム不正値はaria-invalidとlive errorになり保存可能状態を無効化する', () => {
    render(<Preview />);
    act(() => screen.getByRole('tab', { name: 'カスタム' }).click());
    const width = screen.getByLabelText('幅（px）');
    const height = screen.getByLabelText('高さ（px）');
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(width, '300');
      width.dispatchEvent(new Event('input', { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(height, '700');
      height.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(width).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(/幅は320/);
  });

  test('キャンバスは選択サイズをdata属性と実寸styleで公開する', () => {
    render(<Preview />);
    const canvas = screen.getByTestId('content').closest('[data-device-canvas]');
    expect(canvas).toHaveAttribute('data-output-width', '390');
    expect(canvas).toHaveAttribute('data-output-height', '844');
    expect(canvas).toHaveStyle({ width: '390px', height: '844px' });
  });

  test('iPad Pro相当の固定viewportでも利用可能領域内に収まり、Toolbarの倍率と実transformが一致する', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1366 });
    render(<Preview />);
    const canvas = screen.getByTestId('content').closest('[data-device-canvas]') as HTMLElement;
    const frame = canvas.parentElement as HTMLElement;
    await waitFor(() => {
      const scale = Number(frame.dataset.displayScale);
      expect(scale).toBeLessThanOrEqual(1);
      expect(Number.parseFloat(frame.style.width)).toBeLessThanOrEqual(1024);
      expect(Number.parseFloat(frame.style.height)).toBeLessThanOrEqual(1146);
      expect(screen.getByText(`表示倍率 ${Math.round(scale * 100)}%`)).toBeInTheDocument();
    });
  });

  test('auto-heightの親ではなく編集ステージの安定高から縮小率を計算する', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1366 });
    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.matches('[data-device-preview-stage]')) return { width: 900, height: 900, top: 0, left: 0, right: 900, bottom: 900, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
      if (this.matches('[data-device-toolbar]')) return { width: 680, height: 80, top: 0, left: 0, right: 680, bottom: 80, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
      return originalRect.call(this);
    };
    try {
      render(<StableStagePreview />);
      const canvas = screen.getByTestId('stable-content').closest('[data-device-canvas]') as HTMLElement;
      const frame = canvas.parentElement as HTMLElement;
      await waitFor(() => {
        const scale = Number(frame.dataset.displayScale);
        expect(Number.parseFloat(frame.style.height)).toBeLessThanOrEqual(808);
        expect(screen.getByText(`表示倍率 ${Math.round(scale * 100)}%`)).toBeInTheDocument();
      });
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalRect;
    }
  });

  test('専用preview slotのcontent幅を使い、stage全幅へ拡張しない', async () => {
    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.matches('[data-device-preview-stage]')) return { width: 1600, height: 1200, top: 0, left: 0, right: 1600, bottom: 1200, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
      if (this.matches('[data-device-preview-slot]')) return { width: 420, height: 900, top: 0, left: 0, right: 420, bottom: 900, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
      if (this.matches('[data-device-toolbar]')) return { width: 420, height: 80, top: 0, left: 0, right: 420, bottom: 80, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
      return originalRect.call(this);
    };
    try {
      render(<SlotPreview />);
      const frame = screen.getByTestId('slot-content').closest('.device-canvas-frame') as HTMLElement;
      await waitFor(() => {
        expect(Number.parseFloat(frame.style.width)).toBeLessThanOrEqual(420);
        expect(Number.parseFloat(frame.style.height)).toBeLessThanOrEqual(900);
      });
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalRect;
    }
  });
});
