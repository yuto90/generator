import { describe, expect, test } from 'vitest';
import { extractYouTubeId } from './youtube';

describe('extractYouTubeId', () => {
  const id = 'dQw4w9WgXcQ';

  test('各種プレーヤー URL と ID 直接入力に対応する', () => {
    expect(extractYouTubeId(id)).toBe(id);
    expect(extractYouTubeId(`https://www.youtube.com/watch?v=${id}&t=10`)).toBe(id);
    expect(extractYouTubeId(`https://youtu.be/${id}`)).toBe(id);
    expect(extractYouTubeId(`https://www.youtube.com/embed/${id}`)).toBe(id);
    expect(extractYouTubeId(`https://youtube.com/shorts/${id}`)).toBe(id);
    expect(extractYouTubeId(`https://youtube.com/live/${id}`)).toBe(id);
  });

  test('YouTube 以外のドメインと不正な入力を拒否する', () => {
    expect(extractYouTubeId(`https://notyoutube.com/watch?v=${id}`)).toBe('');
    expect(extractYouTubeId('invalid')).toBe('');
    expect(extractYouTubeId(null)).toBe('');
  });

  test('URL として解析できない watch?v= 形式の入力を救済する(music_player 由来)', () => {
    expect(extractYouTubeId(`watch?v=${id}`)).toBe(id);
    expect(extractYouTubeId(`youtube.com/watch?v=${id}`)).toBe(id);
  });
});
