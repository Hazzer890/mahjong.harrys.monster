import { test, expect } from 'bun:test';
import { buildWall, isFlower, isHonor, suit, rank, sortTiles } from './tiles';

const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length]; };

test('wall has 144 tiles, 4 of each non-flower, 1 of each flower', () => {
  const wall = buildWall(() => 0.5);
  expect(wall.length).toBe(144);
  const counts = new Map<string, number>();
  for (const t of wall) counts.set(t, (counts.get(t) ?? 0) + 1);
  expect(counts.get('b1')).toBe(4);
  expect(counts.get('dR')).toBe(4);
  expect(counts.get('f3')).toBe(1);
  expect(counts.size).toBe(34 + 8);
});

test('shuffle uses injected rng (deterministic)', () => {
  const a = buildWall(seq([0.1, 0.9, 0.4]));
  const b = buildWall(seq([0.1, 0.9, 0.4]));
  expect(a).toEqual(b);
});

test('predicates', () => {
  expect(isFlower('f1')).toBe(true);
  expect(isFlower('b1')).toBe(false);
  expect(isHonor('wE')).toBe(true);
  expect(isHonor('dW')).toBe(true);
  expect(isHonor('d9')).toBe(false); // dots are 'd'+digit, dragons 'd'+letter
  expect(suit('c4')).toBe('c');
  expect(rank('c4')).toBe(4);
});

test('sortTiles groups by suit then rank', () => {
  expect(sortTiles(['wE', 'b3', 'b1', 'c9'])).toEqual(['b1', 'b3', 'c9', 'wE']);
});
