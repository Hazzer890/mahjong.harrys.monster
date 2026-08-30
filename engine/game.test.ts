import { test, expect } from 'bun:test';
import { applyAction, GameError, newHand, nextHand, seatWind, RoomConfig } from './game';

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

function stackedWall(
  hands: string[][],
  dealerExtra: string,
  rest: string[],
  dealer = 0,
): string[] {
  const wall: string[] = [];
  for (let round = 0; round < 13; round++)
    for (let i = 0; i < hands.length; i++)
      wall.push(hands[(dealer + i) % hands.length][round]);
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
    { seats: hands.length, length: 'match', minFaan: 0, timer: false, ...config },
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

test('pung claimant cannot declare a self-draw win without drawing a tile', () => {
  const claimedWin = [
    'b9','b9','c1','c2','c3','c4','c5','c6','d1','d2','d3','wS','wS',
  ];
  const g = fixedHand([H.a, H.b, claimedWin, H.d], 'b9', ['b6']);
  applyAction(g, { type: 'discard', seat: 0, tile: 'b9' });
  applyAction(g, { type: 'pass', seat: 1 });
  applyAction(g, { type: 'claim', seat: 2, claim: 'pung' });

  const before = JSON.stringify(g);
  expect(() => applyAction(g, { type: 'selfAction', seat: 2, action: 'win' })).toThrow(GameError);
  expect(JSON.stringify(g)).toBe(before);
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

const fourB1 = ['b1','b1','b1','b1','c1','c2','c3','d1','d2','d3','wE','wE','wS'];
const addedGongJunk = ['c1','c1','c4','c4','c7','c7','d1','d1','d4','d4','wE','wS','wW'];

function walkSeatTwoToFourthB9(g: ReturnType<typeof fixedHand>, seatOnePasses: boolean) {
  applyAction(g, { type: 'discard', seat: 0, tile: 'b9' });
  if (seatOnePasses) applyAction(g, { type: 'pass', seat: 1 });
  applyAction(g, { type: 'claim', seat: 2, claim: 'pung' });

  applyAction(g, { type: 'discard', seat: 2, tile: 'dG' });
  applyAction(g, { type: 'pass', seat: 3 });
  applyAction(g, { type: 'discard', seat: 3, tile: 'wW' });
  applyAction(g, { type: 'discard', seat: 0, tile: 'wW' });
  applyAction(g, { type: 'discard', seat: 1, tile: 'wW' });

  expect(g.turn).toBe(2);
  expect(g.justDrew).toBe('b9');
}

test('concealed gong draws its replacement from the wall tail and keeps the turn', () => {
  const g = fixedHand([fourB1, H.b, H.c, H.d], 'wS', ['b6','b7','b8','c9']);
  applyAction(g, { type: 'selfAction', seat: 0, action: 'concealedGong', tile: 'b1' });

  expect(g.seats[0].melds).toEqual([{
    kind: 'concealedGong', tiles: ['b1','b1','b1','b1'], from: null,
  }]);
  expect(g.seats[0].hand).not.toContain('b1');
  expect(g.seats[0].hand).toContain('c9');
  expect(g.wall).toEqual(['b6','b7','b8']);
  expect(g.turn).toBe(0);
  expect(g.phase).toBe('discard');
  expect(g.justDrew).toBe('c9');
  expect(g.replacementDraw).toBe(true);
  expect(g.anyCall).toBe(true);
});

test('replacement draw flag clears after the gong player discards and play draws normally', () => {
  const g = fixedHand([fourB1, H.b, H.c, addedGongJunk], 'wS', ['b6','b7','b8','c9']);
  applyAction(g, { type: 'selfAction', seat: 0, action: 'concealedGong', tile: 'b1' });
  expect(g.replacementDraw).toBe(true);

  applyAction(g, { type: 'discard', seat: 0, tile: 'c9' });
  expect(g.turn).toBe(1);
  expect(g.justDrew).toBe('b6');
  expect(g.replacementDraw).toBe(false);
});

test('concealed gong with an empty wall ends the hand as goulash', () => {
  const g = fixedHand([fourB1, H.b, H.c, H.d], 'wS', []);
  applyAction(g, { type: 'selfAction', seat: 0, action: 'concealedGong', tile: 'b1' });
  expect(g.phase).toBe('handEnd');
  expect(g.result!.winner).toBeNull();
  expect(g.result!.loser).toBeNull();
});

test('added gong can be robbed for the win without touching the discard pile', () => {
  const g = fixedHand([H.a, winHand, pungHand, H.d], 'b9', ['wW','wW','wW','b9','c9']);
  walkSeatTwoToFourthB9(g, true);

  applyAction(g, { type: 'selfAction', seat: 2, action: 'addedGong', tile: 'b9' });
  expect(g.phase).toBe('claims');
  expect(g.robbing).toEqual({ seat: 2, tile: 'b9' });
  expect(g.pending![1]).toEqual({ options: ['win'], chowTiles: [], response: null });
  expect(g.pending!.filter(Boolean).length).toBe(1);
  const discardsBeforeRob = g.seats.map(seat => [...seat.discards]);

  applyAction(g, { type: 'claim', seat: 1, claim: 'win' });
  expect(g.phase).toBe('handEnd');
  expect(g.result!.winner).toBe(1);
  expect(g.result!.loser).toBe(2);
  expect(g.result!.winTile).toBe('b9');
  expect(g.result!.items).toContainEqual({ name: 'Robbing the gong', faan: 1 });
  expect(g.seats[2].melds[0].kind).toBe('pung');
  expect(g.seats.map(seat => seat.discards)).toEqual(discardsBeforeRob);
});

test('rob window omits seats below the room minimum faan', () => {
  const highFaanRobHand = [
    'b1','b2','b2','b2','b2','b3','b4','b5','b6','b7','b8','b9','b9',
  ];
  const g = fixedHand(
    [H.a, highFaanRobHand, pungHand, H.d],
    'b9',
    ['wW','wW','wW','b9','c9'],
    { minFaan: 9 },
  );
  walkSeatTwoToFourthB9(g, true);

  applyAction(g, { type: 'selfAction', seat: 2, action: 'addedGong', tile: 'b9' });
  expect(g.phase).toBe('claims');
  expect(g.pending![1]).toEqual({ options: ['win'], chowTiles: [], response: null });
  expect(g.pending![3]).toBeNull();
});

test('added gong with no robbers completes and draws replacement', () => {
  const g = fixedHand([H.a, addedGongJunk, pungHand, H.d], 'b9', ['wW','wW','wW','b9','c9']);
  walkSeatTwoToFourthB9(g, false);

  applyAction(g, { type: 'selfAction', seat: 2, action: 'addedGong', tile: 'b9' });
  expect(g.seats[2].melds[0]).toEqual({
    kind: 'gong', tiles: ['b9','b9','b9','b9'], from: 0,
  });
  expect(g.seats[2].hand).not.toContain('b9');
  expect(g.seats[2].hand).toContain('c9');
  expect(g.wall).toEqual([]);
  expect(g.turn).toBe(2);
  expect(g.phase).toBe('discard');
  expect(g.justDrew).toBe('c9');
  expect(g.replacementDraw).toBe(true);
  expect(g.robbing).toBeNull();
});

test('passing a rob prompt completes the added gong', () => {
  const g = fixedHand([H.a, winHand, pungHand, H.d], 'b9', ['wW','wW','wW','b9','c9']);
  walkSeatTwoToFourthB9(g, true);
  applyAction(g, { type: 'selfAction', seat: 2, action: 'addedGong', tile: 'b9' });

  applyAction(g, { type: 'pass', seat: 1 });
  expect(g.seats[2].melds[0].kind).toBe('gong');
  expect(g.turn).toBe(2);
  expect(g.phase).toBe('discard');
  expect(g.justDrew).toBe('c9');
  expect(g.replacementDraw).toBe(true);
  expect(g.robbing).toBeNull();
});

test('self-draw win ends the hand with the tile just drawn', () => {
  const g = fixedHand([H.a, H.b, H.c, H.d], 'b1', ['c9']);
  g.anyDiscard = true;
  applyAction(g, { type: 'selfAction', seat: 0, action: 'win' });
  expect(g.phase).toBe('handEnd');
  expect(g.result!.winner).toBe(0);
  expect(g.result!.loser).toBeNull();
  expect(g.result!.winTile).toBe('b1');
});

test('self-draw win below min faan is rejected without changing state', () => {
  const g = fixedHand([H.a, H.b, H.c, H.d], 'b1', ['c9'], { minFaan: 3 });
  g.anyDiscard = true;
  const before = JSON.stringify(g);
  expect(() => applyAction(g, { type: 'selfAction', seat: 0, action: 'win' })).toThrow(GameError);
  expect(JSON.stringify(g)).toBe(before);
});

test('invalid gong self actions are rejected without changing state', () => {
  const g = fixedHand([H.a, H.b, H.c, H.d], 'd9', ['c9']);
  const before = JSON.stringify(g);
  expect(() => applyAction(g, {
    type: 'selfAction', seat: 1, action: 'concealedGong', tile: 'b5',
  })).toThrow(GameError);
  expect(() => applyAction(g, {
    type: 'selfAction', seat: 0, action: 'concealedGong', tile: 'b1',
  })).toThrow(GameError);
  expect(() => applyAction(g, {
    type: 'selfAction', seat: 0, action: 'addedGong', tile: 'b1',
  })).toThrow(GameError);
  expect(JSON.stringify(g)).toBe(before);
});

const allChowsWaitB3 = [
  'b1','b2','c1','c2','c3','d1','d2','d3','b4','b5','b6','wS','wS',
];

test('discard win payments: loser pays all and result carries the winning hand', () => {
  const g = fixedHand([H.a, allChowsWaitB3, H.c, H.d], 'b3', []);
  g.anyCall = true; // Disable earthly hand: All chows 1 + No flowers 1 + Last tile 1 = 3 faan.

  applyAction(g, { type: 'discard', seat: 0, tile: 'b3' });
  applyAction(g, { type: 'claim', seat: 1, claim: 'win' });

  expect(g.result!.faan).toBe(3);
  expect(g.result!.items).toContainEqual({ name: 'All chows', faan: 1 });
  expect(g.result!.payments).toEqual([-24, 24, 0, 0]); // 2^3 * three opponents.
  expect(g.seats.map(seat => seat.score)).toEqual([-24, 24, 0, 0]);
  expect(g.result!.winTile).toBe('b3');
  expect(g.result!.winningConcealed).toHaveLength(14);
  expect(g.result!.winningConcealed).toContain('b3');
  expect(g.result!.winningMelds).toEqual([]);
});

test('self-draw payments: everyone pays', () => {
  const g = fixedHand([H.a, H.b, H.c, H.d], 'b1', ['c9']);
  g.anyDiscard = true; // Disable heavenly hand: No flowers 1 + Self-draw 1 = 2 faan.

  applyAction(g, { type: 'selfAction', seat: 0, action: 'win' });

  expect(g.result!.faan).toBe(2);
  expect(g.result!.payments).toEqual([12, -4, -4, -4]); // Base 2^2, paid by all three opponents.
  expect(g.seats.map(seat => seat.score)).toEqual([12, -4, -4, -4]);
});

test('goulash: no payments and dealer repeats in the next hand', () => {
  const g = fixedHand(
    [H.a, H.b, H.c, H.d],
    'd9',
    [],
    { length: 'match' },
  );
  applyAction(g, { type: 'discard', seat: 0, tile: 'd9' });

  expect(g.result).toEqual({
    winner: null, loser: null, payments: [0, 0, 0, 0], winTile: undefined,
  });
  const following = nextHand(
    g,
    () => 0,
    stackedWall([H.a, H.b, H.c, H.d], 'b1', ['c9']),
  );
  expect(following.dealer).toBe(0);
  expect(following.roundWind).toBe('E');
  expect(following.seats.map(seat => seat.score)).toEqual([0, 0, 0, 0]);
});

const twoSeatConfig: RoomConfig = {
  seats: 2, length: 'match', minFaan: 0, timer: false,
};

function twoSeatProgressionWall(dealer: number) {
  const hands = dealer === 0
    ? [H.a, allChowsWaitB3]
    : [allChowsWaitB3, H.a];
  return stackedWall(hands, 'b3', [], dealer);
}

function nonDealerWins(g: ReturnType<typeof newHand>) {
  const winner = (g.dealer + 1) % 2;
  g.anyCall = true; // Keep the fixture's score independent of first-turn limit hands.
  applyAction(g, { type: 'discard', seat: g.dealer, tile: 'b3' });
  applyAction(g, { type: 'claim', seat: winner, claim: 'win' });
  return winner;
}

function playTwoSeatMatchToEnd() {
  let g = newHand(
    twoSeatConfig,
    0,
    'E',
    [0, 0],
    () => 0,
    twoSeatProgressionWall(0),
  );

  nonDealerWins(g);
  expect(g.phase).toBe('handEnd');
  g = nextHand(g, () => 0, twoSeatProgressionWall(1));
  expect([g.dealer, g.roundWind]).toEqual([1, 'E']);

  nonDealerWins(g);
  expect(g.phase).toBe('handEnd');
  g = nextHand(g, () => 0, twoSeatProgressionWall(0));
  expect([g.dealer, g.roundWind]).toEqual([0, 'S']);

  nonDealerWins(g);
  expect(g.phase).toBe('handEnd');
  g = nextHand(g, () => 0, twoSeatProgressionWall(1));
  expect([g.dealer, g.roundWind]).toEqual([1, 'S']);

  nonDealerWins(g);
  return g;
}

test('dealer rotation and wind advance through a two-seat match', () => {
  const g = playTwoSeatMatchToEnd();
  expect(g.phase).toBe('matchEnd');
  expect(g.dealer).toBe(1);
  expect(g.roundWind).toBe('S');

  let nonZeroStart = newHand(
    twoSeatConfig,
    1,
    'E',
    [10, -10],
    () => 0,
    twoSeatProgressionWall(1),
  );
  nonDealerWins(nonZeroStart);
  const carriedScores = nonZeroStart.seats.map(seat => seat.score);
  nonZeroStart = nextHand(nonZeroStart, () => 0, twoSeatProgressionWall(0));
  expect([nonZeroStart.startDealer, nonZeroStart.dealer, nonZeroStart.roundWind]).toEqual([1, 0, 'E']);
  expect(nonZeroStart.seats.map(seat => seat.score)).toEqual(carriedScores);

  nonDealerWins(nonZeroStart);
  nonZeroStart = nextHand(nonZeroStart, () => 0, twoSeatProgressionWall(1));
  expect([nonZeroStart.startDealer, nonZeroStart.dealer, nonZeroStart.roundWind]).toEqual([1, 1, 'S']);
});

test("length 'hand' ends after one hand", () => {
  const g = fixedHand([H.a, H.b, H.c, H.d], 'b1', ['c9'], { length: 'hand' });
  g.anyDiscard = true;

  applyAction(g, { type: 'selfAction', seat: 0, action: 'win' });

  expect(g.phase).toBe('matchEnd');
});

test('nextHand rejects a finished match', () => {
  const g = playTwoSeatMatchToEnd();
  expect(() => nextHand(g, () => 0, twoSeatProgressionWall(0))).toThrow(GameError);
});
