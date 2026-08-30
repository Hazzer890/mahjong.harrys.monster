import { test, expect } from 'bun:test';
import { applyAction, GameError, newHand, seatWind, RoomConfig } from './game';

const cfg = (over: Partial<RoomConfig> = {}): RoomConfig =>
  ({ seats: 4, length: 'match', minFaan: 3, timer: false, ...over });

test('deal: 14/13/13/13, wall size, dealer to act', () => {
  const g = newHand(cfg(), 0, 'E', [0,0,0,0], () => 0.5);
  expect(g.seats[0].hand.length).toBe(14);
  expect(g.seats.slice(1).every((s, _) => s.hand.length === 13)).toBe(true);
  const dealt = g.seats.reduce((a, s) => a + s.hand.length + s.flowers.length, 0);
  expect(dealt + g.wall.length).toBe(144);
  expect(g.phase).toBe('discard');
  expect(g.turn).toBe(0);
  expect(g.seats.every(s => s.hand.every(t => t[0] !== 'f'))).toBe(true); // no flowers in hands
});

test('seat winds rotate from dealer', () => {
  const g = newHand(cfg(), 2, 'S', [0,0,0,0], () => 0.5);
  expect(seatWind(g, 2)).toBe('E');
  expect(seatWind(g, 3)).toBe('S');
  expect(seatWind(g, 0)).toBe('W');
  expect(seatWind(g, 1)).toBe('N');
});

test('3-player deal', () => {
  const g = newHand(cfg({ seats: 3 }), 0, 'E', [0,0,0], () => 0.5);
  expect(g.seats.length).toBe(3);
  expect(seatWind(g, 2)).toBe('W');
});

function stackedWall(hands: string[][], dealerExtra: string, rest: string[]): string[] {
  const wall: string[] = [];
  for (let round = 0; round < 13; round++)
    for (const hand of hands) wall.push(hand[round]);
  wall.push(dealerExtra, ...rest);
  return wall;
}

function fixedHand(
  hands: string[][],
  dealerExtra: string,
  rest: string[],
  config: Partial<RoomConfig> = {},
) {
  return newHand(
    { seats: hands.length, length: 'hand', minFaan: 0, timer: false, ...config },
    0,
    'E',
    hands.map(() => 0),
    () => 0,
    stackedWall(hands, dealerExtra, rest),
  );
}

const H = {
  a: ['b1','b1','b2','b3','b4','c1','c2','c3','d1','d2','d3','wE','wE'],
  b: ['b5','b5','b6','b7','b8','c4','c5','c6','d4','d5','d6','wS','wS'],
  c: ['b9','b9','c7','c8','c9','d7','d8','d9','wW','wW','wN','wN','dR'],
  d: ['dR','dR','dG','dG','dG','dW','dW','dW','b2','b3','b4','c7','c8'],
};
const winHand = ['b1','b2','b3','c1','c2','c3','d1','d2','d3','wE','wE','b9','b9'];
const pungHand = ['b9','b9','c4','c5','c6','d4','d5','d6','wS','wS','wN','wN','dG'];

test('discard then all-pass advances turn with a draw', () => {
  const g = fixedHand([H.a, H.b, H.c, H.d], 'd9', ['b6','b7','b8','c9']);
  applyAction(g, { type: 'discard', seat: 0, tile: 'd9' });
  expect(g.turn).toBe(1);
  expect(g.phase).toBe('discard');
  expect(g.seats[1].hand.length).toBe(14);
});

test('pung claim: meld formed, claimant on turn, discard removed from pool', () => {
  const g = fixedHand([H.a, H.b, H.c, H.d], 'dR', ['b6','b7','b8','c9']);
  applyAction(g, { type: 'discard', seat: 0, tile: 'dR' });
  expect(g.phase).toBe('claims');
  applyAction(g, { type: 'claim', seat: 3, claim: 'pung' });
  expect(g.seats[3].melds).toEqual([{ kind: 'pung', tiles: ['dR','dR','dR'], from: 0 }]);
  expect(g.seats[0].discards).toEqual([]);
  expect(g.turn).toBe(3);
  expect(g.phase).toBe('discard');
});

test('chow only from next seat, with chosen tiles', () => {
  const g = fixedHand([H.a, H.b, H.c, H.d], 'b4', ['b6','b7','b8','c9']);
  applyAction(g, { type: 'discard', seat: 0, tile: 'b4' });
  applyAction(g, { type: 'claim', seat: 1, claim: 'chow', tiles: ['b5','b6'] });
  expect(g.seats[1].melds[0]).toEqual({ kind: 'chow', tiles: ['b4','b5','b6'], from: 0 });
});

test('win beats pung when both claim', () => {
  const g = fixedHand([H.a, winHand, pungHand, H.d], 'b9', ['b6','b7','b8','c9']);
  applyAction(g, { type: 'discard', seat: 0, tile: 'b9' });
  applyAction(g, { type: 'claim', seat: 2, claim: 'pung' });
  applyAction(g, { type: 'claim', seat: 1, claim: 'win' });
  expect(g.phase).toBe('handEnd');
  expect(g.result!.winner).toBe(1);
  expect(g.result!.loser).toBe(0);
});

test('illegal actions throw and leave state unchanged', () => {
  const g = fixedHand([H.a, H.b, H.c, H.d], 'd9', ['b6','b7','b8','c9']);
  const before = JSON.stringify(g);
  expect(() => applyAction(g, { type: 'discard', seat: 1, tile: 'b5' })).toThrow(GameError);
  expect(() => applyAction(g, { type: 'discard', seat: 0, tile: 'zz' })).toThrow(GameError);
  expect(JSON.stringify(g)).toBe(before);
});

test('all pending seats pass before the next seat draws from the wall front', () => {
  const g = fixedHand([H.a, winHand, pungHand, H.d], 'b9', ['b6','b7']);
  applyAction(g, { type: 'discard', seat: 0, tile: 'b9' });
  applyAction(g, { type: 'pass', seat: 2 });
  expect(g.phase).toBe('claims');
  applyAction(g, { type: 'pass', seat: 1 });
  expect(g.turn).toBe(1);
  expect(g.justDrew).toBe('b6');
  expect(g.wall).toEqual(['b7']);
  expect(g.pending).toBeNull();
  expect(g.replacementDraw).toBe(false);
  expect(g.anyDiscard).toBe(true);
  expect(g.anyCall).toBe(false);
});

test('minimum faan gates win options', () => {
  const gated = fixedHand([H.a, winHand, pungHand, H.d], 'b9', ['b6'], { minFaan: 3 });
  gated.anyCall = true; // disable earthly hand; this hand otherwise scores one faan
  applyAction(gated, { type: 'discard', seat: 0, tile: 'b9' });
  expect(gated.pending![1]!.options).not.toContain('win');
});

test('minimum faan is revalidated when a win is claimed', () => {
  const revalidated = fixedHand([H.a, winHand, pungHand, H.d], 'b9', ['b6']);
  revalidated.anyCall = true;
  applyAction(revalidated, { type: 'discard', seat: 0, tile: 'b9' });
  expect(revalidated.pending![1]!.options).toContain('win');
  revalidated.config.minFaan = 3;
  const before = JSON.stringify(revalidated);
  expect(() => applyAction(revalidated, { type: 'claim', seat: 1, claim: 'win' })).toThrow(GameError);
  expect(JSON.stringify(revalidated)).toBe(before);
});

test('closest winning claimant to the discarder wins the tie', () => {
  const g = fixedHand([H.a, winHand, winHand, H.d], 'b9', ['b6']);
  applyAction(g, { type: 'discard', seat: 0, tile: 'b9' });
  applyAction(g, { type: 'claim', seat: 2, claim: 'win' });
  applyAction(g, { type: 'claim', seat: 1, claim: 'win' });
  expect(g.result!.winner).toBe(1);
  expect(g.seats[0].discards).toEqual([]);
});

test('closest pung beats a farther gong at the same priority', () => {
  const nearPung = ['dR','dR','b1','b2','b3','c1','c2','c3','d1','d2','d3','wS','wN'];
  const farGong = ['dR','dR','dR','b4','b5','b6','c4','c5','c6','d4','d5','d6','wW'];
  const g = fixedHand([H.a, nearPung, farGong, H.b], 'dR', ['b6','b7']);
  applyAction(g, { type: 'discard', seat: 0, tile: 'dR' });
  applyAction(g, { type: 'claim', seat: 2, claim: 'gong' });
  applyAction(g, { type: 'claim', seat: 1, claim: 'pung' });
  expect(g.turn).toBe(1);
  expect(g.seats[1].melds).toEqual([{ kind: 'pung', tiles: ['dR','dR','dR'], from: 0 }]);
  expect(g.wall).toEqual(['b6','b7']);
});

test('gong claim draws its replacement from the wall tail', () => {
  const gongHand = ['dR','dR','dR','dG','dG','dG','dW','dW','dW','b2','b3','b4','c7'];
  const g = fixedHand([H.a, H.b, H.c, gongHand], 'dR', ['b6','b7','c9']);
  applyAction(g, { type: 'discard', seat: 0, tile: 'dR' });
  applyAction(g, { type: 'claim', seat: 3, claim: 'gong' });
  expect(g.seats[3].melds[0]).toEqual({ kind: 'gong', tiles: ['dR','dR','dR','dR'], from: 0 });
  expect(g.justDrew).toBe('c9');
  expect(g.wall).toEqual(['b6','b7']);
  expect(g.replacementDraw).toBe(true);
  expect(g.anyCall).toBe(true);
  expect(g.phase).toBe('discard');
});

test('invalid chow tiles throw without recording a response or mutating state', () => {
  const g = fixedHand([H.a, H.b, H.c, H.d], 'b4', ['b6']);
  applyAction(g, { type: 'discard', seat: 0, tile: 'b4' });
  const before = JSON.stringify(g);
  expect(() => applyAction(g, {
    type: 'claim', seat: 1, claim: 'chow', tiles: ['b5','b7'],
  })).toThrow(GameError);
  expect(JSON.stringify(g)).toBe(before);
});

test('empty wall ends the hand after an unclaimed discard', () => {
  const unclaimed = fixedHand([H.a, H.b, H.c, H.d], 'd9', []);
  applyAction(unclaimed, { type: 'discard', seat: 0, tile: 'd9' });
  expect(unclaimed.phase).toBe('handEnd');
  expect(unclaimed.result).toEqual({
    winner: null, loser: null, payments: [0,0,0,0], winTile: undefined,
  });
});

test('empty wall ends the hand after a gong claim', () => {
  const gongHand = ['dR','dR','dR','dG','dG','dG','dW','dW','dW','b2','b3','b4','c7'];
  const gong = fixedHand([H.a, H.b, H.c, gongHand], 'dR', []);
  applyAction(gong, { type: 'discard', seat: 0, tile: 'dR' });
  applyAction(gong, { type: 'claim', seat: 3, claim: 'gong' });
  expect(gong.phase).toBe('handEnd');
  expect(gong.result!.winner).toBeNull();
  expect(gong.result!.loser).toBeNull();
});
