import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocalAudio } from './useLocalAudio';

class AudioElementStub {
  currentTime = 0;
  duration = Number.NaN;
  volume = 1;
  src = '';
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  private listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: string, listener: EventListener) {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string) {
    this.listeners.get(type)?.forEach((listener) => listener(new Event(type)));
  }
}

describe('useLocalAudio', () => {
  let audio: AudioElementStub;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    audio = new AudioElementStub();
    vi.stubGlobal('Audio', vi.fn(() => audio));
    createObjectURL = vi.fn((file: File) => `blob:${file.name}`);
    revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.stubGlobal('AudioContext', vi.fn(() => ({
      decodeAudioData: vi.fn(() => Promise.resolve({ duration: 0 })),
      close: vi.fn(() => Promise.resolve()),
    })));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('選択したファイルごとに Object URL を一つ作成する', async () => {
    const { result } = renderHook(() => useLocalAudio());
    const file = new File(['audio'], 'first.mp3', { type: 'audio/mpeg' });

    await act(async () => result.current.selectFile(file));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(result.current.file).toBe(file);
  });

  it('メタデータ読み込み時に音源の長さを更新する', async () => {
    const { result } = renderHook(() => useLocalAudio());
    await act(async () => result.current.selectFile(new File(['audio'], 'first.mp3')));

    audio.duration = 42.5;
    act(() => audio.dispatch('loadedmetadata'));

    await waitFor(() => expect(result.current.duration).toBe(42.5));
  });

  it('ファイルを置き換えると古い Object URL を解放する', async () => {
    const { result } = renderHook(() => useLocalAudio());
    await act(async () => result.current.selectFile(new File(['one'], 'first.mp3')));
    await act(async () => result.current.selectFile(new File(['two'], 'second.mp3')));

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:first.mp3');
  });

  it('アンマウント時に Object URL を解放する', async () => {
    const { result, unmount } = renderHook(() => useLocalAudio());
    await act(async () => result.current.selectFile(new File(['audio'], 'first.mp3')));

    unmount();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:first.mp3');
  });

  it('デコードに失敗しても AudioContext を閉じる', async () => {
    const close = vi.fn(() => Promise.resolve());
    vi.stubGlobal('AudioContext', vi.fn(() => ({
      decodeAudioData: vi.fn(() => Promise.reject(new Error('decode failed'))),
      close,
    })));
    const { result } = renderHook(() => useLocalAudio());
    const file = new File(['audio'], 'first.mp3');
    Object.defineProperty(file, 'arrayBuffer', { value: vi.fn(() => Promise.resolve(new ArrayBuffer(1))) });

    await act(async () => result.current.selectFile(file));

    expect(close).toHaveBeenCalledOnce();
    expect(result.current.error).toBe('音源を読み込めませんでした。');
  });

  it('選択済みのローカル音源を再生・停止・シークできる', async () => {
    const { result } = renderHook(() => useLocalAudio());
    await act(async () => result.current.selectFile(new File(['audio'], 'first.mp3')));
    audio.pause.mockClear();

    await act(async () => result.current.play());
    act(() => result.current.seek(12));
    act(() => result.current.pause());

    expect(audio.play).toHaveBeenCalledOnce();
    expect(audio.currentTime).toBe(12);
    expect(audio.pause).toHaveBeenCalledOnce();
  });
});
