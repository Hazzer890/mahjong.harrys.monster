import { test, expect } from 'bun:test';
import { scoreHand, WinContext } from './faan';
import { Meld } from './hand';

const ctx = (over: Partial<WinContext> = {}): WinContext => ({
  seatWind: 'E', roundWind: 'E', flowers: [], seatWindIndex: 0,
  selfDraw: false, lastTile: false, robbingGong: false, replacementDraw: false,
  heavenly: false, earthly: false, ...over,
});
const pung = (t: string): Meld => ({ kind: 'pung', tiles: [t, t, t], from: 1 });
const names = (s: { items: { name: string }[] }) => s.items.map(i => i.name);

test('flowerless chicken hand scores 1 (no-flowers bonus)', () => {
  // mixed suits with a pung => neither all-chows nor all-pungs
  const s = scoreHand(['b1','b2','b3','c4','c4','c4','d7','d8','d9','b5','b6','b7','wN','wN'], [], ctx({ seatWind:'S' }))!;
  expect(s.faan).toBe(1);
});

test('all chows = 1', () => {
  const s = scoreHand(['b1','b2','b3','b4','b5','b6','c1','c2','c3','d7','d8','d9','d5','d5'], [], ctx({ seatWind:'S' }))!;
  expect(s.faan).toBe(2);
  expect(names(s)).toContain('All chows');
});

test('all pungs + mixed one suit + seat & round wind', () => {
  const s = scoreHand(['b1','b1','b1','b5','b5','b5','wE','wE','wE','b9','b9'], [pung('b3')], ctx())!;
  // all pungs 3 + mixed suit 3 + seat wind 1 + round wind 1 + no flowers 1 = 9
  expect(s.faan).toBe(9);
});

test('pure one suit = 7', () => {
  const s = scoreHand(['b1','b2','b3','b4','b5','b6','b7','b8','b9','b2','b3','b4','b9','b9'], [], ctx({ seatWind:'S', roundWind:'S' }))!;
  expect(s.faan).toBe(9); // pure 7 + all chows 1 + no flowers 1
});

test('great dragons caps at 13', () => {
  const s = scoreHand(['dR','dR','dR','dG','dG','dG','dW','dW','dW','b1','b2','b3','c5','c5'], [], ctx({ seatWind:'S' }))!;
  expect(s.faan).toBe(13);
});

test('small dragons: 2 dragon pungs + pair + bonus', () => {
  const s = scoreHand(['dR','dR','dR','dG','dG','dG','dW','dW','b1','b2','b3','c4','c5','c6'], [], ctx({ seatWind:'S' }))!;
  // dragon pung ×2 + small dragons 3 + no flowers 1 = 6
  expect(s.faan).toBe(6);
});

test('flowers: own quartet, no-flowers bonus', () => {
  const base = ['b1','b2','b3','b4','b5','b6','c1','c2','c3','d7','d8','d9','d5','d5'];
  const none = scoreHand(base, [], ctx({ seatWind:'S' }))!;
  expect(names(none)).toContain('No flowers'); // 1 (all chows) + 1
  expect(none.faan).toBe(2);
  const quartet = scoreHand(base, [], ctx({ seatWind:'S', flowers: ['f1','f2','f3','f4'] }))!;
  expect(quartet.faan).toBe(1 + 4 + 2); // all chows + 4 flowers + quartet
});

test('situational faan stack', () => {
  const s = scoreHand(['b1','b2','b3','b4','b5','b6','c1','c2','c3','d7','d8','d9','d5','d5'], [],
    ctx({ seatWind:'S', selfDraw: true, lastTile: true, replacementDraw: true }))!;
  expect(s.faan).toBe(1 + 1 + 1 + 1 + 1); // all chows + selfDraw + lastTile + replacement + no flowers
});

test('heavenly = 13', () => {
  const s = scoreHand(['b1','b2','b3','b4','b5','b6','c1','c2','c3','d7','d8','d9','d5','d5'], [], ctx({ heavenly: true }))!;
  expect(s.faan).toBe(13);
});

test('non-winning hand returns null', () => {
  expect(scoreHand(['b1','b2','b5','b6','c1','c2','c3','d7','d8','d9','wE','wS','d5','d5'], [], ctx())).toBe(null);
});

test('picks max-faan decomposition', () => {
  // The chow reading (123 123 123 789 + 55) beats the pung reading.
  const s = scoreHand(['b1','b1','b1','b2','b2','b2','b3','b3','b3','b7','b8','b9','b5','b5'], [], ctx({ seatWind:'S' }))!;
  expect(s.faan).toBe(9); // pure 7 + all chows 1 + no flowers 1
});
