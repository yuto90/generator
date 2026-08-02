import { useId, type KeyboardEvent } from 'react';
import { useDevicePreview } from './DevicePreviewContext';
import { DEVICE_PRESETS, getDisplayScale, hasCustomSizeErrors, type DevicePreviewMode } from './device-preview';
import './device-preview.css';

const MODES: readonly { id: DevicePreviewMode; label: string }[] = [
  { id: 'device', label: 'この端末' },
  { id: 'preset', label: '端末プリセット' },
  { id: 'custom', label: 'カスタム' },
];

export interface DeviceToolbarProps {
  className?: string;
}

export function DeviceToolbar({ className = '' }: DeviceToolbarProps) {
  const {
    settings,
    viewport,
    outputSize,
    adjusted,
    valid,
    customErrors,
    setMode,
    setPreset,
    setCustom,
  } = useDevicePreview();
  const id = useId();
  const errorId = `${id}-errors`;
  const hasErrors = hasCustomSizeErrors(customErrors);
  const displayScale = getDisplayScale(outputSize, {
    width: Math.max(280, viewport.width - 64),
    height: Math.max(420, viewport.height - 220),
  });

  function handleModeKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = MODES.findIndex(mode => mode.id === settings.mode);
    let nextIndex = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % MODES.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + MODES.length) % MODES.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = MODES.length - 1;
    if (nextIndex === index) return;
    event.preventDefault();
    setMode(MODES[nextIndex].id);
    document.getElementById(`${id}-${MODES[nextIndex].id}`)?.focus();
  }

  return (
    <section className={`device-toolbar ${className}`} aria-label="端末プレビュー設定" data-device-toolbar>
      <div className="device-toolbar__modes" role="tablist" aria-label="プレビューサイズの種類">
        {MODES.map(mode => (
          <button
            className="device-toolbar__mode"
            id={`${id}-${mode.id}`}
            key={mode.id}
            role="tab"
            aria-selected={settings.mode === mode.id}
            aria-controls={`${id}-panel`}
            tabIndex={settings.mode === mode.id ? 0 : -1}
            type="button"
            onClick={() => setMode(mode.id)}
            onKeyDown={handleModeKeyDown}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className="device-toolbar__panel" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${settings.mode}`}>
        {settings.mode === 'preset' && (
          <label className="device-toolbar__field">
            <span>端末</span>
            <select value={settings.presetId} onChange={event => setPreset(event.target.value)}>
              {DEVICE_PRESETS.map(preset => (
                <option value={preset.id} key={preset.id}>{preset.label}（{preset.width}×{preset.height}）</option>
              ))}
            </select>
          </label>
        )}

        {settings.mode === 'custom' && (
          <div className="device-toolbar__custom-fields">
            <label className="device-toolbar__field">
              <span>幅（px）</span>
              <input
                type="text"
                inputMode="numeric"
                value={settings.custom.width}
                aria-invalid={Boolean(customErrors.width || customErrors.orientation)}
                aria-describedby={errorId}
                onChange={event => setCustom({ ...settings.custom, width: event.target.value })}
              />
            </label>
            <span className="device-toolbar__times" aria-hidden="true">×</span>
            <label className="device-toolbar__field">
              <span>高さ（px）</span>
              <input
                type="text"
                inputMode="numeric"
                value={settings.custom.height}
                aria-invalid={Boolean(customErrors.height || customErrors.orientation)}
                aria-describedby={errorId}
                onChange={event => setCustom({ ...settings.custom, height: event.target.value })}
              />
            </label>
          </div>
        )}

        <div className="device-toolbar__summary" aria-live="polite">
          <span>出力サイズ {outputSize.width}×{outputSize.height}px</span>
          <span>表示倍率 {Math.round(displayScale * 100)}%</span>
        </div>
        {adjusted && settings.mode === 'device' && (
          <p className="device-toolbar__notice">この端末の比率を保ったまま、保存可能な範囲へ調整しています。</p>
        )}
        {settings.mode === 'custom' && (
          <div className="device-toolbar__errors" id={errorId} role="alert" aria-live="polite">
            {customErrors.width && <span>{customErrors.width}</span>}
            {customErrors.height && <span>{customErrors.height}</span>}
            {customErrors.orientation && <span>{customErrors.orientation}</span>}
            {!hasErrors && <span className="device-toolbar__valid">指定サイズで保存できます。</span>}
          </div>
        )}
        {!valid && <span className="device-toolbar__invalid" aria-live="polite">不正なサイズのため保存できません。</span>}
      </div>
    </section>
  );
}
