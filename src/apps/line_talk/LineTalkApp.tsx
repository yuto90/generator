import { useRef, useState } from 'react';
import { useCapture } from '../../shared/capture/useCapture';
import { ThemeToggle } from '../../shared/theme/ThemeToggle';
import './line-talk.css';

export type MessageDirection = 'sent' | 'received';

export interface TalkMessage {
  id: string;
  direction: MessageDirection;
  text: string;
  time: string;
  isRead: boolean;
}

export interface TalkContent {
  partnerName: string;
  messages: TalkMessage[];
}

export interface TalkFieldError {
  text?: string;
  time?: string;
}

export interface TalkValidationErrors {
  partnerName?: string;
  messageCount?: string;
  totalNewlines?: string;
  totalTextLength?: string;
  messages: Record<string, TalkFieldError>;
}

const INITIAL_CONTENT: TalkContent = {
  partnerName: 'あかり',
  messages: [
    {
      id: 'message-1',
      direction: 'received',
      text: '今日はどうだった？',
      time: '18:42',
      isRead: false,
    },
    {
      id: 'message-2',
      direction: 'sent',
      text: '楽しかったよ！また行こうね。',
      time: '18:45',
      isRead: true,
    },
    {
      id: 'message-3',
      direction: 'received',
      text: 'うん、次はどこに行く？',
      time: '18:46',
      isRead: false,
    },
  ],
};

const MAX_MESSAGES = 20;
const MAX_MESSAGE_TEXT_LENGTH = 200;
const MAX_MESSAGE_INPUT_LENGTH = MAX_MESSAGE_TEXT_LENGTH * 2;
const MAX_MESSAGE_NEWLINES = 10;
const MAX_TOTAL_MESSAGE_NEWLINES = 40;
const MAX_TOTAL_MESSAGE_INPUT_LENGTH = 2000;

function countMessageText(text: string) {
  return text.replace(/\s/g, '').length;
}

function countMessageNewlines(text: string) {
  return text.match(/\r\n|\r|\n/g)?.length ?? 0;
}

function getTotalNewlineError(content: TalkContent) {
  const totalNewlines = content.messages.reduce(
    (total, message) => total + countMessageNewlines(message.text),
    0,
  );
  return totalNewlines > MAX_TOTAL_MESSAGE_NEWLINES
    ? `メッセージ全体の改行は${MAX_TOTAL_MESSAGE_NEWLINES}回以内で入力してください`
    : undefined;
}

function getTotalTextLengthError(content: TalkContent) {
  const totalTextLength = content.messages.reduce((total, message) => total + message.text.length, 0);
  return totalTextLength > MAX_TOTAL_MESSAGE_INPUT_LENGTH
    ? `メッセージ全体の本文は${MAX_TOTAL_MESSAGE_INPUT_LENGTH}文字以内で入力してください`
    : undefined;
}

function syncAggregateErrors(errors: TalkValidationErrors, content: TalkContent) {
  const totalNewlineError = getTotalNewlineError(content);
  if (totalNewlineError) {
    errors.totalNewlines = totalNewlineError;
  } else {
    delete errors.totalNewlines;
  }
  const totalTextLengthError = getTotalTextLengthError(content);
  if (totalTextLengthError) {
    errors.totalTextLength = totalTextLengthError;
  } else {
    delete errors.totalTextLength;
  }
}

function cloneContent(content: TalkContent): TalkContent {
  return {
    partnerName: content.partnerName,
    messages: content.messages.map(message => ({ ...message })),
  };
}

export function validateTalkContent(content: TalkContent): TalkValidationErrors {
  const errors: TalkValidationErrors = { messages: {} };

  if (content.messages.length < 1 || content.messages.length > MAX_MESSAGES) {
    errors.messageCount = 'メッセージは1〜20件で入力してください';
  }

  syncAggregateErrors(errors, content);

  content.messages.forEach(message => {
    const messageErrors: TalkFieldError = {};
    const textLength = countMessageText(message.text);
    if (textLength < 1 || textLength > MAX_MESSAGE_TEXT_LENGTH) {
      messageErrors.text = '本文は空白を除いて1〜200文字で入力してください';
    } else if (message.text.length > MAX_MESSAGE_INPUT_LENGTH) {
      messageErrors.text = `本文は全体で${MAX_MESSAGE_INPUT_LENGTH}文字以内で入力してください`;
    } else if (countMessageNewlines(message.text) > MAX_MESSAGE_NEWLINES) {
      messageErrors.text = `本文の改行は${MAX_MESSAGE_NEWLINES}回以内で入力してください`;
    }
    if (!message.time.trim()) {
      messageErrors.time = '時刻を入力してください';
    }
    if (messageErrors.text || messageErrors.time) {
      errors.messages[message.id] = messageErrors;
    }
  });

  return errors;
}

function hasValidationErrors(errors: TalkValidationErrors) {
  return Boolean(
    errors.partnerName ||
      errors.messageCount ||
      errors.totalNewlines ||
      errors.totalTextLength ||
      Object.values(errors.messages).some(messageErrors => messageErrors.text || messageErrors.time),
  );
}

function createMessage(id: string): TalkMessage {
  return {
    id,
    direction: 'sent',
    text: 'メッセージを入力',
    time: '12:00',
    isRead: true,
  };
}

function messageFieldId(messageId: string, field: 'text' | 'time') {
  return `line-talk-${messageId}-${field}`;
}

export default function LineTalkApp() {
  const [draft, setDraft] = useState<TalkContent>(() => cloneContent(INITIAL_CONTENT));
  const [applied, setApplied] = useState<TalkContent>(() => cloneContent(INITIAL_CONTENT));
  const [errors, setErrors] = useState<TalkValidationErrors>({ messages: {} });
  const [saveStatus, setSaveStatus] = useState('');
  const nextId = useRef(4);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const { capture, capturing } = useCapture();

  function updateDraft(updater: (current: TalkContent) => TalkContent) {
    setDraft(updater);
  }

  function updateMessage(messageId: string, changes: Partial<TalkMessage>) {
    const nextDraft: TalkContent = {
      ...draft,
      messages: draft.messages.map(message =>
        message.id === messageId ? { ...message, ...changes } : message,
      ),
    };
    updateDraft(() => nextDraft);
    if (!('text' in changes) && !('time' in changes)) return;

    setErrors(current => {
      const next = { ...current, messages: { ...current.messages } };
      syncAggregateErrors(next, nextDraft);

      const messageErrors = current.messages[messageId];
      if (!messageErrors) return next;

      const nextMessageErrors = { ...messageErrors };
      if ('text' in changes) delete nextMessageErrors.text;
      if ('time' in changes) delete nextMessageErrors.time;
      if (nextMessageErrors.text || nextMessageErrors.time) {
        next.messages[messageId] = nextMessageErrors;
      } else {
        delete next.messages[messageId];
      }
      return next;
    });
  }

  function changeDirection(messageId: string, direction: MessageDirection) {
    updateMessage(messageId, { direction, isRead: false });
  }

  function addMessage() {
    if (draft.messages.length >= MAX_MESSAGES) return;
    const id = `message-${nextId.current}`;
    nextId.current += 1;
    updateDraft(current => ({ ...current, messages: [...current.messages, createMessage(id)] }));
    setErrors(current => ({ ...current, messageCount: undefined }));
  }

  function removeMessage(messageId: string) {
    const nextDraft: TalkContent = {
      ...draft,
      messages: draft.messages.filter(message => message.id !== messageId),
    };
    updateDraft(() => nextDraft);
    setErrors(current => {
      const next = { ...current, messages: { ...current.messages } };
      syncAggregateErrors(next, nextDraft);
      delete next.messages[messageId];
      return next;
    });
  }

  function moveMessage(messageId: string, offset: -1 | 1) {
    updateDraft(current => {
      const index = current.messages.findIndex(message => message.id === messageId);
      const nextIndex = index + offset;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.messages.length) return current;
      const messages = [...current.messages];
      const [message] = messages.splice(index, 1);
      messages.splice(nextIndex, 0, message);
      return { ...current, messages };
    });
  }

  function applyPreview() {
    const validation = validateTalkContent(draft);
    setErrors(validation);
    if (hasValidationErrors(validation)) return;

    setApplied({
      partnerName: draft.partnerName.trim() || '相手',
      messages: draft.messages.map(message => ({
        ...message,
        time: message.time.trim(),
        isRead: message.direction === 'sent' && message.isRead,
      })),
    });
  }

  async function saveImage() {
    const preview = previewRef.current;
    const originalWidth = preview?.style.width ?? '';
    try {
      if (preview) {
        const measuredWidth = preview.getBoundingClientRect().width;
        if (measuredWidth > 0) preview.style.width = `${measuredWidth}px`;
      }
      await capture(preview, 'line_talk.png');
      setSaveStatus('保存操作を開始しました');
    } catch (error: unknown) {
      setSaveStatus(error instanceof Error ? error.message : '画像を生成できませんでした。もう一度お試しください。');
    } finally {
      if (preview) preview.style.width = originalWidth;
    }
  }

  return (
    <div className="app-line-talk">
      <div className="line-talk-layout">
        <section className="line-talk-preview-column" aria-label="トーク画面プレビュー">
          <div
            className="line-talk-preview"
            data-testid="line-talk-preview"
            ref={previewRef}
            aria-label="LINEトーク画面プレビュー"
          >
            <header className="line-talk-header">
              <span className="line-talk-header-icon" aria-hidden="true">‹</span>
              <div className="line-talk-header-copy">
                <strong>{applied.partnerName}</strong>
                <span>オンライン</span>
              </div>
              <div className="line-talk-header-actions" aria-hidden="true">
                <span>⌕</span>
                <span>⋮</span>
              </div>
            </header>

            <section className="line-talk-conversation" aria-label="会話">
              {applied.messages.map(message => (
                <article
                  className={`line-talk-preview-message ${message.direction}`}
                  data-testid="line-talk-preview-message"
                  data-direction={message.direction}
                  data-message-id={message.id}
                  key={message.id}
                >
                  {message.direction === 'sent' && (
                    <div className="line-talk-message-meta">
                      <span>{message.time}</span>
                      {message.isRead && <span className="line-talk-read">既読</span>}
                    </div>
                  )}
                  <div className="line-talk-bubble">{message.text}</div>
                  {message.direction === 'received' && (
                    <div className="line-talk-message-meta">
                      <span>{message.time}</span>
                    </div>
                  )}
                </article>
              ))}
            </section>

            <div className="line-talk-input-bar" aria-hidden="true">
              <span className="line-talk-input-icon">＋</span>
              <span className="line-talk-input-placeholder">メッセージを入力</span>
              <span className="line-talk-input-icon">☺</span>
              <span className="line-talk-input-send">➤</span>
            </div>
          </div>
        </section>

        <aside className="line-talk-editor" aria-label="LINEトーク編集パネル">
          <div className="line-talk-editor-heading">
            <div>
              <span className="line-talk-accent-dot" aria-hidden="true" />
              <h1>LINEトーク</h1>
            </div>
            <ThemeToggle className="theme-toggle" />
          </div>

          <div className="line-talk-field">
            <label className="line-talk-label" htmlFor="line-talk-partner-name">相手の名前</label>
            <input
              className="line-talk-input"
              id="line-talk-partner-name"
              type="text"
              value={draft.partnerName}
              onChange={event => updateDraft(current => ({ ...current, partnerName: event.target.value }))}
              placeholder="相手"
            />
            <p className="line-talk-help">空欄の場合は「相手」と表示します</p>
          </div>

          <div className="line-talk-messages-heading">
            <h2>メッセージ</h2>
            <span>{draft.messages.length} / {MAX_MESSAGES}</span>
          </div>
          {errors.messageCount && (
            <p className="line-talk-error" id="line-talk-message-count-error" role="alert">{errors.messageCount}</p>
          )}
          {errors.totalNewlines && (
            <p className="line-talk-error" id="line-talk-message-newline-error" role="alert">{errors.totalNewlines}</p>
          )}
          {errors.totalTextLength && (
            <p className="line-talk-error" id="line-talk-message-length-error" role="alert">{errors.totalTextLength}</p>
          )}

          <div
            className="line-talk-editor-messages"
            aria-invalid={Boolean(errors.messageCount || errors.totalNewlines || errors.totalTextLength)}
            aria-describedby={[
              errors.messageCount && 'line-talk-message-count-error',
              errors.totalNewlines && 'line-talk-message-newline-error',
              errors.totalTextLength && 'line-talk-message-length-error',
            ].filter(Boolean).join(' ') || undefined}
          >
            {draft.messages.map((message, index) => {
              const messageErrors = errors.messages[message.id] ?? {};
              const textId = messageFieldId(message.id, 'text');
              const timeId = messageFieldId(message.id, 'time');
              const textErrorId = `${textId}-error`;
              const timeErrorId = `${timeId}-error`;
              return (
                <fieldset className="line-talk-message-editor" data-testid="line-talk-editor-message" key={message.id}>
                  <legend>メッセージ {index + 1}</legend>

                  <div className="line-talk-message-editor-row">
                    <div className="line-talk-field line-talk-direction-field">
                      <label className="line-talk-label" htmlFor={`line-talk-${message.id}-direction`}>メッセージ {index + 1} の送受信</label>
                      <select
                        className="line-talk-input"
                        id={`line-talk-${message.id}-direction`}
                        aria-label={`メッセージ ${index + 1} の送受信`}
                        value={message.direction}
                        onChange={event => changeDirection(message.id, event.target.value as MessageDirection)}
                      >
                        <option value="received">受信</option>
                        <option value="sent">送信</option>
                      </select>
                    </div>
                    <div className="line-talk-field line-talk-time-field">
                      <label className="line-talk-label" htmlFor={timeId}>メッセージ {index + 1} の時刻</label>
                      <input
                        className="line-talk-input"
                        id={timeId}
                        type="text"
                        inputMode="numeric"
                        value={message.time}
                        onChange={event => updateMessage(message.id, { time: event.target.value })}
                        aria-invalid={Boolean(messageErrors.time)}
                        aria-describedby={messageErrors.time ? timeErrorId : undefined}
                        placeholder="12:00"
                      />
                      {messageErrors.time && <p className="line-talk-error" id={timeErrorId}>{messageErrors.time}</p>}
                    </div>
                  </div>

                  <div className="line-talk-field">
                    <label className="line-talk-label" htmlFor={textId}>メッセージ {index + 1} の本文</label>
                    <textarea
                      className="line-talk-input line-talk-textarea"
                      id={textId}
                      rows={3}
                      value={message.text}
                      onChange={event => updateMessage(message.id, { text: event.target.value })}
                      aria-invalid={Boolean(messageErrors.text)}
                      aria-describedby={messageErrors.text ? textErrorId : undefined}
                      placeholder="本文を入力"
                    />
                    <div className="line-talk-input-footer">
                      <span className="line-talk-help">空白を除いて1〜200文字、全体で400文字以内・改行10回以内</span>
                      <span className="line-talk-counter">{countMessageText(message.text)} / 200</span>
                    </div>
                    {messageErrors.text && <p className="line-talk-error" id={textErrorId}>{messageErrors.text}</p>}
                  </div>

                  <label className="line-talk-check">
                    <input
                      type="checkbox"
                      aria-label={`メッセージ ${index + 1} の既読`}
                      checked={message.direction === 'sent' && message.isRead}
                      disabled={message.direction === 'received'}
                      onChange={event => updateMessage(message.id, { isRead: event.target.checked })}
                    />
                    <span>既読（送信時のみ）</span>
                  </label>

                  <div className="line-talk-message-actions">
                    <button type="button" className="line-talk-secondary-button" onClick={() => moveMessage(message.id, -1)} disabled={index === 0} aria-label={`メッセージ ${index + 1} を上へ`}>↑ 上へ</button>
                    <button type="button" className="line-talk-secondary-button" onClick={() => moveMessage(message.id, 1)} disabled={index === draft.messages.length - 1} aria-label={`メッセージ ${index + 1} を下へ`}>↓ 下へ</button>
                    <button type="button" className="line-talk-delete-button" onClick={() => removeMessage(message.id)} aria-label={`メッセージ ${index + 1} を削除`}>削除</button>
                  </div>
                </fieldset>
              );
            })}
          </div>

          <button className="line-talk-add-button" type="button" onClick={addMessage} disabled={draft.messages.length >= MAX_MESSAGES} aria-label="メッセージを追加">＋ メッセージを追加</button>

          <div className="line-talk-editor-actions">
            <button className="line-talk-apply-button" type="button" onClick={applyPreview}>適用してプレビュー</button>
            <button className="line-talk-save-button" type="button" onClick={saveImage} disabled={capturing}>
              {capturing ? '画像を生成中…' : '画像として保存'}
            </button>
          </div>
          <p className="line-talk-status" role="status" aria-live="polite">{saveStatus}</p>
        </aside>
      </div>
    </div>
  );
}
