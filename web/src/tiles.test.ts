import { describe, expect, test } from 'bun:test';
import { kindOf, pips } from './tiles';

describe('kindOf', () => {
  test('disambiguates dots from dragons despite sharing the d prefix', () => {
    expect(kindOf('d5')).toBe('d');
    expect(kindOf('dR')).toBe('dragon');
    expect(kindOf('dG')).toBe('dragon');
    expect(kindOf('dW')).toBe('dragon');
  });

  test('classifies the other suits and honors', () => {
    expect(kindOf('b3')).toBe('b');
    expect(kindOf('c9')).toBe('c');
    expect(kindOf('wE')).toBe('wind');
    expect(kindOf('f1')).toBe('flower');
  });
});

describe('pips', () => {
  test('returns exactly n coordinates for 1..9 and falls back for out-of-range', () => {
    for (let n = 1; n <= 9; n++) expect(pips(n)).toHaveLength(n);
    expect(pips(10)).toHaveLength(9);
  });
});
