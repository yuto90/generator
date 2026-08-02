import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../shared/theme/ThemeContext';
import LineTalkApp from './LineTalkApp';

const captureSnap = vi.hoisted(() => vi.fn());
const download = vi.hoisted(() => vi.fn<() => Promise<void>>());

vi.mock('@zumer/snapdom', () => ({
  snapdom: captureSnap,
}));

beforeEach(() => {
  download.mockReset();
  download.mockResolvedValue(undefined);
  captureSnap.mockReset();
  captureSnap.mockResolvedValue({
    toCanvas: vi.fn().mockResolvedValue(document.createElement('canvas')),
    download,
  });
});

function renderApp() {
  return render(
    <ThemeProvider>
      <LineTalkApp />
    </ThemeProvider>,
  );
}

describe('LineTalkApp', () => {
  test('初期サンプルと編集パネル、縦長プレビューを表示する', () => {
    renderApp();

    expect(screen.getByLabelText('相手の名前')).toHaveValue('あかり');
    expect(screen.getAllByTestId('line-talk-preview-message')).toHaveLength(3);
    expect(screen.getByTestId('line-talk-preview')).toHaveClass('line-talk-preview');
    expect(screen.getByTestId('line-talk-preview').querySelector('.line-talk-header-avatar')).toBeNull();
    expect(screen.getByRole('button', { name: '適用してプレビュー' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '画像として保存' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'メッセージを追加' })).toBeInTheDocument();
  });

  test('編集内容は適用後だけプレビューへ反映し、改行と時刻を保持する', async () => {
    const user = userEvent.setup();
    renderApp();
    const partnerName = screen.getByLabelText('相手の名前');
    const text = screen.getByLabelText('メッセージ 1 の本文');
    const time = screen.getByLabelText('メッセージ 1 の時刻');

    await user.clear(partnerName);
    await user.type(partnerName, 'ゆうと');
    await user.clear(text);
    await user.type(text, '一行目\n二行目');
    await user.clear(time);
    await user.type(time, '21:05');

    expect(screen.getByTestId('line-talk-preview')).not.toHaveTextContent('ゆうと');
    await user.click(screen.getByRole('button', { name: '適用してプレビュー' }));

    expect(screen.getByTestId('line-talk-preview')).toHaveTextContent('ゆうと');
    const firstBubble = screen.getAllByTestId('line-talk-preview-message')[0].querySelector('.line-talk-bubble');
    expect(firstBubble?.textContent).toBe('一行目\n二行目');
    expect(screen.getByTestId('line-talk-preview')).toHaveTextContent('21:05');
  });

  test('不正な本文や時刻ではエラーを表示し、適用済みプレビューを維持する', async () => {
    const user = userEvent.setup();
    renderApp();
    const preview = screen.getByTestId('line-talk-preview');
    const originalText = screen.getAllByTestId('line-talk-preview-message')[0].textContent;
    const text = screen.getByLabelText('メッセージ 1 の本文');
    const time = screen.getByLabelText('メッセージ 1 の時刻');

    await user.clear(text);
    await user.clear(time);
    await user.click(screen.getByRole('button', { name: '適用してプレビュー' }));

    expect(screen.getByText('本文は空白を除いて1〜200文字で入力してください')).toBeInTheDocument();
    expect(screen.getByText('時刻を入力してください')).toBeInTheDocument();
    expect(text).toHaveAttribute('aria-invalid', 'true');
    expect(time).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByTestId('line-talk-preview-message')[0]).toHaveTextContent(originalText ?? '');
    expect(preview).not.toHaveTextContent('21:05');
  });

  test('相手名が空なら適用時に「相手」を表示し、空白だけの本文を拒否する', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.clear(screen.getByLabelText('相手の名前'));
    await user.clear(screen.getByLabelText('メッセージ 1 の本文'));
    await user.type(screen.getByLabelText('メッセージ 1 の本文'), ' \n\t');
    await user.click(screen.getByRole('button', { name: '適用してプレビュー' }));

    expect(screen.getByText('本文は空白を除いて1〜200文字で入力してください')).toBeInTheDocument();
    expect(screen.getByTestId('line-talk-preview')).toHaveTextContent('あかり');

    await user.clear(screen.getByLabelText('メッセージ 1 の本文'));
    await user.type(screen.getByLabelText('メッセージ 1 の本文'), '本文');
    await user.click(screen.getByRole('button', { name: '適用してプレビュー' }));
    expect(screen.getByTestId('line-talk-preview')).toHaveTextContent('相手');
  });

  test('本文の201文字超過、0件、時刻未入力を検証する', async () => {
    const user = userEvent.setup();
    renderApp();
    const text = screen.getByLabelText('メッセージ 1 の本文');
    await user.clear(text);
    await user.type(text, 'あ'.repeat(201));
    await user.click(screen.getByRole('button', { name: '適用してプレビュー' }));
    expect(screen.getByText('本文は空白を除いて1〜200文字で入力してください')).toBeInTheDocument();

    for (const button of screen.getAllByRole('button', { name: /を削除$/ })) {
      await user.click(button);
    }
    await user.click(screen.getByRole('button', { name: '適用してプレビュー' }));
    expect(screen.getByText('メッセージは1〜20件で入力してください')).toBeInTheDocument();
  });

  test('本文は200文字まで適用できる', async () => {
    const user = userEvent.setup();
    renderApp();
    const text = screen.getByLabelText('メッセージ 1 の本文');
    await user.clear(text);
    await user.type(text, 'あ'.repeat(200));
    await user.click(screen.getByRole('button', { name: '適用してプレビュー' }));

    expect(screen.queryByText('本文は空白を除いて1〜200文字で入力してください')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('line-talk-preview-message')[0].querySelector('.line-talk-bubble')).toHaveTextContent('あ'.repeat(200));
  });

  test('本文の全体入力長が上限を超える場合は空白を除く文字数が範囲内でも拒否する', async () => {
    const user = userEvent.setup();
    renderApp();
    const text = screen.getByLabelText('メッセージ 1 の本文');
    await user.clear(text);
    await user.type(text, `${'あ'.repeat(200)}${' '.repeat(201)}`);
    await user.click(screen.getByRole('button', { name: '適用してプレビュー' }));

    expect(screen.getByText('本文は全体で400文字以内で入力してください')).toBeInTheDocument();
    expect(text).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByTestId('line-talk-preview-message')[0]).toHaveTextContent('今日はどうだった？');
  });

  test('本文の改行数が上限を超える場合は空白を除く文字数が範囲内でも拒否する', async () => {
    const user = userEvent.setup();
    renderApp();
    const text = screen.getByLabelText('メッセージ 1 の本文');
    await user.clear(text);
    await user.type(text, `あ${'\n'.repeat(11)}`);
    await user.click(screen.getByRole('button', { name: '適用してプレビュー' }));

    expect(screen.getByText('本文の改行は10回以内で入力してください')).toBeInTheDocument();
    expect(text).toHaveAttribute('aria-invalid', 'true');
  });

  test('プレビュー列はmainではないランドマークで構成する', () => {
    renderApp();

    const previewColumn = screen.getByTestId('line-talk-preview').parentElement;
    expect(previewColumn?.tagName).toBe('SECTION');
    expect(previewColumn).toHaveAttribute('aria-label', 'トーク画面プレビュー');
  });

  test('追加は20件で上限になり、削除と上下移動を編集へ反映する', async () => {
    const user = userEvent.setup();
    renderApp();
    const add = screen.getByRole('button', { name: 'メッセージを追加' });

    for (let index = 0; index < 17; index += 1) {
      await user.click(add);
    }
    expect(screen.getAllByTestId('line-talk-editor-message')).toHaveLength(20);
    expect(add).toBeDisabled();

    const secondUp = screen.getByRole('button', { name: 'メッセージ 2 を上へ' });
    await user.click(secondUp);
    expect(screen.getAllByTestId('line-talk-editor-message')[0].textContent).toContain('楽しかったよ！また行こうね。');

    await user.click(screen.getByRole('button', { name: 'メッセージ 1 を削除' }));
    expect(screen.getAllByTestId('line-talk-editor-message')).toHaveLength(19);
    expect(add).toBeEnabled();
  });

  test('受信へ変更すると既読を解除してプレビューにも既読を表示しない', async () => {
    const user = userEvent.setup();
    renderApp();
    const direction = screen.getByLabelText('メッセージ 2 の送受信');
    const read = screen.getByLabelText('メッセージ 2 の既読');

    expect(read).toBeChecked();
    await user.selectOptions(direction, 'received');
    expect(read).not.toBeChecked();
    expect(read).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '適用してプレビュー' }));

    const previewMessages = screen.getAllByTestId('line-talk-preview-message');
    expect(previewMessages[1]).toHaveAttribute('data-direction', 'received');
    expect(previewMessages[1]).not.toHaveTextContent('既読');
  });

  test('狭幅プレビューの保存では測定幅を複製へ渡し、完了後に元の幅指定を戻す', async () => {
    const user = userEvent.setup();
    renderApp();
    const preview = screen.getByTestId('line-talk-preview');
    vi.spyOn(preview, 'getBoundingClientRect').mockReturnValue({ width: 355 } as DOMRect);
    captureSnap.mockImplementation(async (captureTarget: HTMLElement) => {
      expect(captureTarget.style.width).toBe('355px');
      return {
        toCanvas: vi.fn().mockResolvedValue(document.createElement('canvas')),
        download,
      };
    });

    await user.click(screen.getByRole('button', { name: '画像として保存' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('保存操作を開始しました'));
    expect(preview.style.width).toBe('');
  });

  test('狭幅プレビューの保存に失敗しても一時的な幅指定を復元する', async () => {
    const user = userEvent.setup();
    renderApp();
    const preview = screen.getByTestId('line-talk-preview');
    preview.style.width = 'calc(100% - 1px)';
    vi.spyOn(preview, 'getBoundingClientRect').mockReturnValue({ width: 355 } as DOMRect);
    captureSnap.mockImplementation(async (captureTarget: HTMLElement) => {
      expect(captureTarget.style.width).toBe('355px');
      return {
        toCanvas: vi.fn().mockResolvedValue(document.createElement('canvas')),
        download,
      };
    });
    download.mockRejectedValueOnce(new Error('renderer failed'));

    await user.click(screen.getByRole('button', { name: '画像として保存' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('画像を生成できませんでした。ページを再読み込みして、もう一度お試しください。'));
    expect(preview.style.width).toBe('calc(100% - 1px)');
  });

  test('保存中は再押下を無効化し、line_talk.pngで保存する', async () => {
    let resolveDownload!: () => void;
    download.mockReturnValueOnce(new Promise<void>(resolve => { resolveDownload = resolve; }));
    const user = userEvent.setup();
    renderApp();
    const save = screen.getByRole('button', { name: '画像として保存' });

    await user.click(save);
    expect(save).toBeDisabled();
    expect(save).toHaveTextContent('画像を生成中…');
    expect(captureSnap).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ filename: 'line_talk.png' }));

    resolveDownload();
    await waitFor(() => expect(save).not.toBeDisabled());
    expect(screen.getByRole('status')).toHaveTextContent('保存操作を開始しました');
  });

  test('保存に失敗した場合は利用者向けエラーを表示する', async () => {
    download.mockRejectedValueOnce(new Error('renderer failed'));
    const user = userEvent.setup();
    renderApp();
    const save = screen.getByRole('button', { name: '画像として保存' });

    await user.click(save);

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('画像を生成できませんでした。ページを再読み込みして、もう一度お試しください。'));
    expect(save).not.toBeDisabled();
  });
});
