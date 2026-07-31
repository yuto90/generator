import { describe, expect, it } from 'vitest';
import {
  calculateVideoClipRange,
  calculateVideoOutputHeight,
  getVideoFrameTime,
  parseVideoStartTime,
} from './video-timeline';

describe('parseVideoStartTime', () => {
  it.each([
    ['0:00', 0],
    ['1:20', 80],
    ['  01:02  ', 62],
  ])('%s を秒数に変換する', (value, expected) => {
    expect(parseVideoStartTime(value)).toBe(expected);
  });

  it.each(['', '1', '1:2:3', '1:60', '-1:20', '1:-20', 'abc', 'NaN:00'])(
    '%s は無効な開始時刻として拒否する',
    (value) => {
      expect(parseVideoStartTime(value)).toBeNull();
    },
  );
});

describe('calculateVideoClipRange', () => {
  it('音源が1秒未満なら切り出せない', () => {
    expect(calculateVideoClipRange(0.99, 0)).toBeNull();
  });

  it('開始時刻が音源末尾なら切り出せない', () => {
    expect(calculateVideoClipRange(10, 10)).toBeNull();
  });

  it('30秒を上限にする', () => {
    expect(calculateVideoClipRange(90, 10)).toEqual({
      start: 10,
      end: 40,
      duration: 30,
    });
  });

  it('終端に近い開始時刻では音源末尾までの範囲を返す', () => {
    expect(calculateVideoClipRange(35.5, 20)).toEqual({
      start: 20,
      end: 35.5,
      duration: 15.5,
    });
  });

  it('残り時間が1秒未満なら切り出せない', () => {
    expect(calculateVideoClipRange(10, 9.01)).toBeNull();
  });

  it('残り時間がちょうど1秒なら切り出せる', () => {
    expect(calculateVideoClipRange(10, 9)).toEqual({
      start: 9,
      end: 10,
      duration: 1,
    });
  });

  it.each([
    [Number.NaN, 0],
    [30, Number.POSITIVE_INFINITY],
    [30, -1],
  ])('有限でない、または負の値を拒否する', (duration, start) => {
    expect(calculateVideoClipRange(duration, start)).toBeNull();
  });
});

describe('getVideoFrameTime', () => {
  it('フレーム番号を範囲内の再生時刻へ変換する', () => {
    expect(getVideoFrameTime({ start: 10, end: 20, duration: 10 }, 15, 30)).toBe(10.5);
  });

  it('最終時刻を範囲終端でクランプする', () => {
    expect(getVideoFrameTime({ start: 10, end: 20, duration: 10 }, 400, 30)).toBe(20);
  });
});

describe('calculateVideoOutputHeight', () => {
  it('CSS上の縦横比を出力幅へ適用する', () => {
    expect(calculateVideoOutputHeight(375, 667, 1080)).toBe(1920);
  });

  it('奇数の高さは最も近い偶数へ丸める', () => {
    expect(calculateVideoOutputHeight(100, 101, 100)).toBe(102);
    expect(calculateVideoOutputHeight(100, 99, 100)).toBe(100);
  });
});
