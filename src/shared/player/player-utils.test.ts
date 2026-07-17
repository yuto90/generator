import { describe, expect, test } from 'vitest';
import { calculateProgress, formatTime, parseTime } from './player-utils';

describe('parseTime', () => {
  test('m:ss 形式を受け付け、不正な入力は null を返す', () => {
    expect(parseTime('0:00')).toBe(0);
    expect(parseTime('1:23')).toBe(83);
    expect(parseTime('123:59')).toBe(7439);
    expect(parseTime('')).toBeNull();
    expect(parseTime('1:2')).toBeNull();
    expect(parseTime('1:60')).toBeNull();
    expect(parseTime('-1:00')).toBeNull();
  });
});

describe('formatTime', () => {
  test('非負の秒数を m:ss として整形する', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(83)).toBe('1:23');
    expect(formatTime(7439)).toBe('123:59');
    expect(formatTime(-10)).toBe('0:00');
  });
});

describe('calculateProgress', () => {
  test('不正な duration を扱い、結果を 0-100 に丸める', () => {
    expect(calculateProgress(30, 120)).toBe(25);
    expect(calculateProgress(-1, 120)).toBe(0);
    expect(calculateProgress(130, 120)).toBe(100);
    expect(calculateProgress(30, 0)).toBe(0);
  });
});
