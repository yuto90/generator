import { useState, type ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createEditableImage, type EditableImage } from './image-crop';
import ImageCropField from './ImageCropField';

vi.mock('react-image-crop', () => ({
  default: ({ children, aspect, onComplete }: { children: ReactNode; aspect?: number; onComplete?: (crop: unknown, percentCrop: unknown) => void }) => (
    <div data-testid="react-crop" data-aspect={aspect ?? ''}>
      {children}
      <button
        type="button"
        data-testid="mock-crop-complete"
        onClick={() => onComplete?.(
          { unit: 'px', x: 0, y: 0, width: 80, height: 60 },
          { unit: '%', x: 0, y: 0, width: 80, height: 60 },
        )}
      >
        選択範囲を確定
      </button>
    </div>
  ),
}));

vi.mock('./image-crop', async () => {
  const actual = await vi.importActual<typeof import('./image-crop')>('./image-crop');
  return {
    ...actual,
    cropImageToDataUrl: vi.fn(async () => 'data:image/png;base64,cropped'),
  };
});

const defaultProps = {
  id: 'in-image',
  label: 'Cover Image',
  value: createEditableImage('default'),
  targetAspect: 1,
  onChange: vi.fn(),
};

function ControlledField({ initialValue = defaultProps.value }: { initialValue?: EditableImage }) {
  const [value, setValue] = useState(initialValue);
  return <ImageCropField {...defaultProps} value={value} onChange={setValue} />;
}

describe('ImageCropField', () => {
  test('未アップロード時は調整ボタンを無効にする', () => {
    render(<ImageCropField {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'トリミングを調整' })).toBeDisabled();
  });

  test('画像選択後に調整ボタンを有効にする', async () => {
    const user = userEvent.setup();
    render(<ControlledField />);

    await user.upload(screen.getByLabelText('Cover Image'), new File(['image'], 'cover.png', { type: 'image/png' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'トリミングを調整' })).toBeEnabled());
  });

  test('画像以外のファイルはエラーにして入力をリセットする', async () => {
    render(<ImageCropField {...defaultProps} />);
    const input = screen.getByLabelText('Cover Image') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(['text'], 'notes.txt', { type: 'text/plain' })] },
    });

    expect(screen.getByText('画像ファイルを選択してください')).toBeInTheDocument();
    expect(input.value).toBe('');
  });

  test('調整ダイアログの初期余白は黒で、白へ切り替えられる', async () => {
    const user = userEvent.setup();
    render(<ImageCropField {...defaultProps} value={createEditableImage('source', 'source')} />);

    await user.click(screen.getByRole('button', { name: 'トリミングを調整' }));

    expect(screen.getByRole('button', { name: '黒' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: '白' }));
    expect(screen.getByRole('button', { name: '白' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '黒' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('枠いっぱいにするをONにすると対象比率固定になり、完了でcoverを返す', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ImageCropField {...defaultProps} value={createEditableImage('source', 'source')} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'トリミングを調整' }));
    const image = screen.getByRole('img', { name: 'Cover Imageのトリミング対象' });
    Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 100 });
    Object.defineProperty(image, 'naturalHeight', { configurable: true, value: 100 });
    Object.defineProperty(image, 'width', { configurable: true, value: 100 });
    Object.defineProperty(image, 'height', { configurable: true, value: 100 });
    fireEvent.load(image);

    const lockButton = screen.getByRole('button', { name: '枠いっぱいにする' });
    expect(lockButton).toHaveAttribute('aria-pressed', 'false');
    await user.click(lockButton);
    expect(lockButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('プレビュー枠と同じ比率で固定中')).toBeInTheDocument();
    expect(screen.getByTestId('react-crop')).toHaveAttribute('data-aspect', '1');

    await user.click(screen.getByTestId('mock-crop-complete'));
    await waitFor(() => expect(screen.getByRole('button', { name: '完了' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: '完了' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      fit: 'cover',
      cropAspectLocked: true,
    }));
  });

  test('保存済みの固定状態を再編集時に復元する', async () => {
    render(<ImageCropField {...defaultProps} value={{ ...createEditableImage('source', 'source'), cropAspectLocked: true }} />);

    await userEvent.click(screen.getByRole('button', { name: 'トリミングを調整' }));

    expect(screen.getByRole('button', { name: '枠いっぱいにする' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('キャンセルでは編集前の値を変更しない', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ImageCropField {...defaultProps} value={createEditableImage('source', 'source')} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'トリミングを調整' }));
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(onChange).not.toHaveBeenCalled();
  });

  test('Escで調整をキャンセルする', async () => {
    const onChange = vi.fn();
    render(<ImageCropField {...defaultProps} value={createEditableImage('source', 'source')} onChange={onChange} />);

    const adjust = screen.getByRole('button', { name: 'トリミングを調整' });
    await userEvent.click(adjust);
    const dialog = screen.getByRole('dialog');
    fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }));

    expect(dialog).not.toHaveAttribute('open');
    expect(onChange).not.toHaveBeenCalled();
  });

  test('完了で切り抜きPNGとcontain表示を値へ反映する', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ImageCropField {...defaultProps} value={createEditableImage('source', 'source')} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'トリミングを調整' }));
    const image = screen.getByRole('img', { name: 'Cover Imageのトリミング対象' });
    Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 100 });
    Object.defineProperty(image, 'naturalHeight', { configurable: true, value: 100 });
    Object.defineProperty(image, 'width', { configurable: true, value: 100 });
    Object.defineProperty(image, 'height', { configurable: true, value: 100 });
    fireEvent.load(image);
    await user.click(screen.getByTestId('mock-crop-complete'));
    await waitFor(() => expect(screen.getByRole('button', { name: '完了' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: '完了' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      originalSrc: 'source',
      displaySrc: 'data:image/png;base64,cropped',
      fit: 'contain',
      cropAspectLocked: false,
      matteColor: 'black',
    }));
  });
});
