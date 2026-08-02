import { describe, expect, test } from 'vitest';
import { GENERATORS } from './generators';

describe('ジェネレーターレジストリ', () => {
  test('LINEトーク画面風ジェネレーターを公開する', () => {
    expect(GENERATORS.find(generator => generator.id === 'line_talk')).toMatchObject({
      id: 'line_talk',
      name: 'LINEトーク',
      title: 'LINE talk generator',
    });
  });
});
