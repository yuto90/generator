import { act, render, screen } from '@testing-library/react';
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
});
