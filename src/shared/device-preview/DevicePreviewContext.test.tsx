import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';
import { DevicePreviewProvider, useDevicePreview } from './DevicePreviewContext';

function Probe() {
  const preview = useDevicePreview();
  return (
    <div>
      <output data-testid="mode">{preview.settings.mode}</output>
      <output data-testid="size">{preview.outputSize.width}x{preview.outputSize.height}</output>
      <output data-testid="valid">{String(preview.valid)}</output>
      <button type="button" onClick={() => preview.setMode('preset')}>プリセット</button>
      <button type="button" onClick={() => preview.setCustom({ width: '320', height: '568' })}>カスタム</button>
    </div>
  );
}

describe('DevicePreviewProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
  });

  test('初期値はこの端末でviewport変更へ追従する', () => {
    render(<DevicePreviewProvider><Probe /></DevicePreviewProvider>);
    expect(screen.getByTestId('mode')).toHaveTextContent('device');
    expect(screen.getByTestId('size')).toHaveTextContent('390x844');
    act(() => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 844 });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 390 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('size')).toHaveTextContent('390x844');
  });

  test('モードとカスタムサイズを共有localStorageへ保存・復元する', () => {
    const first = render(<DevicePreviewProvider><Probe /></DevicePreviewProvider>);
    act(() => screen.getByRole('button', { name: 'カスタム' }).click());
    expect(screen.getByTestId('size')).toHaveTextContent('320x568');
    first.unmount();
    render(<DevicePreviewProvider><Probe /></DevicePreviewProvider>);
    expect(screen.getByTestId('mode')).toHaveTextContent('custom');
    expect(screen.getByTestId('size')).toHaveTextContent('320x568');
  });

  test('不正なカスタム入力ではvalid=falseとなる', () => {
    render(<DevicePreviewProvider><Probe /></DevicePreviewProvider>);
    act(() => screen.getByRole('button', { name: 'プリセット' }).click());
    expect(screen.getByTestId('valid')).toHaveTextContent('true');
  });

  test('壊れたlocalStorage値は初期値へ復旧して保存し直す', () => {
    window.localStorage.setItem('generator-device-preview', '{broken');
    render(<DevicePreviewProvider><Probe /></DevicePreviewProvider>);
    expect(screen.getByTestId('mode')).toHaveTextContent('device');
    expect(JSON.parse(window.localStorage.getItem('generator-device-preview') ?? '{}')).toMatchObject({ mode: 'device' });
  });
});
