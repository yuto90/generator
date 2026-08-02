import { describe, expect, test } from 'vitest';
import { GENERATORS } from './generators';

describe('ジェネレータレジストリ', () => {
  test('汎用Music Playerを公開せずApple Musicを既定にする', () => {
    expect(GENERATORS.map(generator => generator.id)).not.toContain('music_player');
    expect(GENERATORS[0]?.id).toBe('apple_music_player');
  });
});
