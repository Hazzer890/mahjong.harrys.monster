import { expect, test } from 'bun:test';
import { newHand, type PendingClaim, type RoomConfig } from '../engine/game';
import type { Room } from './rooms';
import { buildView } from './protocol';

const config: RoomConfig = { seats: 2, length: 'hand', minFaan: 0, timer: false };

function stackedWall(hands: string[][], dealerExtra: string, rest: string[]): string[] {
  const wall: string[] = [];
  for (let round = 0; round < 13; round++)
    for (let seat = 0; seat < hands.length; seat++) wall.push(hands[seat][round]);
  wall.push(dealerExtra, ...rest);
  return wall;
}

function gameRoom(): Room {
  const hands = [
    ['b1','b1','b2','b3','b4','c1','c2','c3','d1','d2','d3','wE','wE'],
    ['b5','b5','b6','b7','b8','c4','c5','c6','c7','d4','d5','wS','wS'],
  ];
  const game = newHand(
    config,
    0,
    'E',
    [0, 0],
    () => 0,
    stackedWall(hands, 'd9', ['f8', 'b9']),
  );
  return {
    code: 'TEST',
    config,
    players: [
      { token: 'host-token', name: 'Harry', seat: 0, connected: true },
      { token: 'guest-token', name: 'Gus', seat: 1, connected: true },
    ],
    hostToken: 'host-token',
    game,
    lastActivity: 0,
    seq: 1,
    rng: () => 0,
  };
}

test('buildView reveals only the viewer hand and reports the wall as a count', () => {
  const view = buildView(gameRoom(), 0);
  const json = JSON.stringify(view);

  expect(view.you).toBe(0);
  expect(view.host).toBe(true);
  expect(view.game?.hand).toHaveLength(14);
  expect(view.seats[1].handCount).toBe(13);
  expect(view.game?.wallCount).toBe(2);
  expect(json).not.toContain('"c7"');
  expect(json).not.toContain('"f8"');
  expect(Object.keys(view.game!)).not.toContain('wall');
});

test('buildView exposes an unanswered prompt only to its claimant', () => {
  const room = gameRoom();
  const prompt: PendingClaim = {
    options: ['pung'],
    chowTiles: [['b5', 'b6']],
    response: null,
  };
  room.game!.phase = 'claims';
  room.game!.pending = [null, prompt];

  expect(buildView(room, 0).game?.prompt).toBeNull();
  expect(buildView(room, 1).game?.prompt).toEqual({
    options: ['pung'],
    chowTiles: [['b5', 'b6']],
  });

  prompt.response = 'pass';
  expect(buildView(room, 1).game?.prompt).toBeNull();
});

test('buildView hides concealed gong tiles from opponents but shows them to the owner', () => {
  const room = gameRoom();
  const tile = room.game!.seats[0].hand[0];
  room.game!.seats[0].melds.push({
    kind: 'concealedGong',
    tiles: [tile, tile, tile, tile],
    from: null,
  });

  expect(buildView(room, 0).seats[0].melds[0].tiles).toEqual([tile, tile, tile, tile]);
  expect(buildView(room, 1).seats[0].melds[0].tiles).toEqual([]);
});

test('buildView exposes the public robbing tile during an added-gong claim window', () => {
  const room = gameRoom();
  const tile = room.game!.seats[0].hand[0];
  room.game!.phase = 'claims';
  room.game!.robbing = { seat: 0, tile };
  room.game!.pending = [null, {
    options: ['win'],
    chowTiles: [],
    response: null,
  }];

  expect(buildView(room, 1).game?.robbing).toEqual({ seat: 0, tile });
});

test('buildView reports paused while any seated player is disconnected', () => {
  const room = gameRoom();
  room.players[1].connected = false;

  expect(buildView(room, 0).phase).toBe('paused');
});

test('buildView reports lobby before a game starts', () => {
  const room = gameRoom();
  room.game = null;

  const view = buildView(room, 1);
  expect(view.phase).toBe('lobby');
  expect(view.game).toBeNull();
});
