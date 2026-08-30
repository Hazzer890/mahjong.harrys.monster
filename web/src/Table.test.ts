import { describe, expect, test } from 'bun:test';
import { seatPosition } from './Table';

describe('seatPosition', () => {
  test('2p: the lone opponent renders top, not right', () => {
    expect(seatPosition(1, 2)).toBe('top');
  });

  test('3p: right then top', () => {
    expect(seatPosition(1, 3)).toBe('right');
    expect(seatPosition(2, 3)).toBe('top');
  });

  test('4p: right, top, left', () => {
    expect(seatPosition(1, 4)).toBe('right');
    expect(seatPosition(2, 4)).toBe('top');
    expect(seatPosition(3, 4)).toBe('left');
  });
});
