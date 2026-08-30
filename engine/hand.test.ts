import { test, expect } from 'bun:test';
import { decompose, isWinning } from './hand';

const wins: [string, string[], number][] = [
  ['all chows', ['b1','b2','b3','b4','b5','b6','c1','c2','c3','d7','d8','d9','wE','wE'], 0],
  ['all pungs', ['b1','b1','b1','c2','c2','c2','d3','d3','d3','wN','wN','wN','dR','dR'], 0],
  ['with 2 melds', ['b1','b2','b3','c5','c5','c5','d9','d9'], 2],
  ['pair only, 4 melds', ['wE','wE'], 4],
  ['nine gates shape', ['b1','b1','b1','b2','b3','b4','b5','b6','b7','b8','b9','b9','b9','b5'], 0],
  ['chow/pung ambiguity', ['b1','b1','b1','b2','b2','b2','b3','b3','b3','c4','c5','c6','d8','d8'], 0],
];
for (const [name, tiles, melds] of wins)
  test(`win: ${name}`, () => expect(isWinning(tiles, melds)).toBe(true));

const losses: [string, string[], number][] = [
  ['one off', ['b1','b2','b3','b4','b5','b6','c1','c2','c3','d7','d8','d9','wE','wS'], 0],
  ['no pair', ['b1','b2','b3','b4','b5','b6','b7','b8','b9','c1','c2','c3','d1','d2'], 0],
  ['honors cannot chow', ['wE','wS','wW','b1','b2','b3','c1','c2','c3','d1','d2','d3','dR','dR'], 0],
  ['wrong count', ['b1','b2','b3','wE','wE'], 2],
];
for (const [name, tiles, melds] of losses)
  test(`no win: ${name}`, () => expect(isWinning(tiles, melds)).toBe(false));

test('ambiguous hand yields multiple decompositions', () => {
  const d = decompose(['b1','b1','b1','b2','b2','b2','b3','b3','b3','c4','c5','c6','d8','d8'], 0);
  expect(d.length).toBeGreaterThan(1); // 111/222/333 as pungs OR 123×3 as chows
});

import { canPung, canGongDiscard, chowOptions, concealedGongOptions, addedGongOptions } from './hand';

test('pung/gong eligibility', () => {
  expect(canPung(['b1','b1','c3'], 'b1')).toBe(true);
  expect(canPung(['b1','c3'], 'b1')).toBe(false);
  expect(canGongDiscard(['b1','b1','b1'], 'b1')).toBe(true);
  expect(canGongDiscard(['b1','b1'], 'b1')).toBe(false);
});

test('chowOptions returns every window, suited only', () => {
  expect(chowOptions(['b1','b2','b4','b5'], 'b3').sort()).toEqual(
    [['b1','b2'],['b2','b4'],['b4','b5']].sort());
  expect(chowOptions(['wE','wS'], 'wW')).toEqual([]);
  expect(chowOptions(['b8','b9'], 'b7')).toEqual([['b8','b9']]);
});

test('concealed and added gong options', () => {
  expect(concealedGongOptions(['b1','b1','b1','b1','c2'])).toEqual(['b1']);
  expect(addedGongOptions(['d5','c1'], [{ kind:'pung', tiles:['d5','d5','d5'], from:1 }])).toEqual(['d5']);
});
