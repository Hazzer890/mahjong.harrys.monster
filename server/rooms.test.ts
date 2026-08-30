import { test, expect } from 'bun:test';
import { Rooms } from './rooms';

const cfg = { seats: 2, length: 'hand' as const, minFaan: 0, timer: false };

test('create + join fills seats in order', () => {
  const rooms = new Rooms();
  const { room, player } = rooms.createRoom('harry', cfg);
  expect(room.code).toMatch(/^[A-HJ-KM-NP-Z]{4}$/);
  expect(player.seat).toBe(0);
  const { player: p2 } = rooms.join(room.code, 'gus');
  expect(p2.seat).toBe(1);
  expect(() => rooms.join(room.code, 'third')).toThrow(); // full
});

test('token reconnect reclaims seat', () => {
  const rooms = new Rooms();
  const { room, player } = rooms.createRoom('harry', cfg);
  rooms.disconnect(room.code, player.token);
  expect(room.players[0].connected).toBe(false);
  const { player: again } = rooms.join(room.code, 'ignored', player.token);
  expect(again.seat).toBe(0);
  expect(room.players.length).toBe(1);
  expect(room.players[0].connected).toBe(true);
});

test('start deals a game; act routes by token; paused room rejects actions', () => {
  const rooms = new Rooms();
  const { room, player: p1 } = rooms.createRoom('harry', cfg);
  const { player: p2 } = rooms.join(room.code, 'gus');
  rooms.start(room, () => 0.42);
  expect(room.game).not.toBeNull();
  const dealerToken = room.game!.turn === 0 ? p1.token : p2.token;
  const tile = room.game!.seats[room.game!.turn].hand[0];
  rooms.disconnect(room.code, room.game!.turn === 0 ? p2.token : p1.token);
  expect(() => rooms.act(room, dealerToken, { type: 'discard', tile })).toThrow(/paused/);
  rooms.join(room.code, 'x', room.game!.turn === 0 ? p2.token : p1.token);
  rooms.act(room, dealerToken, { type: 'discard', tile });
  expect(room.seq).toBeGreaterThan(0);
});

test('start rejects replacing a game that has already started', () => {
  const rooms = new Rooms();
  const { room } = rooms.createRoom('harry', cfg);
  rooms.join(room.code, 'gus');
  rooms.start(room, () => 0.42);
  const game = room.game;
  const seq = room.seq;

  expect(() => rooms.start(room, () => 0.75)).toThrow('game already started');
  expect(room.game).toBe(game);
  expect(room.seq).toBe(seq);
});

test('create and join reject invalid player names', () => {
  const rooms = new Rooms();

  expect(() => rooms.createRoom('   ', cfg)).toThrow(/name/i);
  expect(() => rooms.createRoom('x'.repeat(25), cfg)).toThrow(/name/i);
  expect(() => rooms.createRoom(42 as unknown as string, cfg)).toThrow(/name/i);

  const { room } = rooms.createRoom('harry', cfg);
  expect(() => rooms.join(room.code, '', undefined)).toThrow(/name/i);
  expect(() => rooms.join(room.code, ' x '.repeat(9), undefined)).toThrow(/name/i);
  expect(() => rooms.join(room.code, null as unknown as string, undefined)).toThrow(/name/i);

  const { player } = rooms.join(room.code, `${' '.repeat(1_000)}gus   `);
  expect(player.name).toBe('gus');
});

test('sweep deletes idle rooms', () => {
  const rooms = new Rooms();
  const { room } = rooms.createRoom('harry', cfg);
  rooms.sweep(Date.now() + 7 * 3600_000);
  expect(rooms.get(room.code)).toBeUndefined();
});

function playHandToMatchEnd(rooms: Rooms, room: ReturnType<Rooms['createRoom']>['room']) {
  const tokens = room.players.map(player => player.token);

  for (let actions = 0; actions < 1_000 && room.game!.phase !== 'matchEnd'; actions++) {
    const game = room.game!;
    if (game.phase === 'discard') {
      rooms.act(room, tokens[game.turn], { type: 'discard', tile: game.seats[game.turn].hand[0] });
      continue;
    }

    if (game.phase === 'claims') {
      for (let seat = 0; seat < game.config.seats; seat++) {
        if (game.pending?.[seat]?.response === null)
          rooms.act(room, tokens[seat], { type: 'pass' });
      }
    }
  }

  expect(room.game!.phase).toBe('matchEnd');
}

test('rematch is rejected before matchEnd and starts a fresh zero-score game after matchEnd', () => {
  const rooms = new Rooms();
  const { room } = rooms.createRoom('harry', cfg);
  rooms.join(room.code, 'gus');
  rooms.start(room, () => 0.42);
  const firstGame = room.game;

  expect(() => rooms.rematch(room, () => 0.75)).toThrow();
  playHandToMatchEnd(rooms, room);
  const seq = room.seq;
  rooms.rematch(room, () => 0.75);

  expect(room.game).not.toBe(firstGame);
  expect(room.game!.dealer).toBe(1);
  expect(room.game!.seats.map(seat => seat.score)).toEqual([0, 0]);
  expect(room.seq).toBe(seq + 1);
});

test('act rejects an unknown token without changing the room sequence', () => {
  const rooms = new Rooms();
  const { room } = rooms.createRoom('harry', cfg);
  rooms.join(room.code, 'gus');
  rooms.start(room, () => 0.42);
  const seq = room.seq;
  const tile = room.game!.seats[room.game!.turn].hand[0];

  expect(() => rooms.act(room, 'unknown', { type: 'discard', tile })).toThrow();
  expect(room.seq).toBe(seq);
});

test('nextHand through act rejects before handEnd without replacing the game', () => {
  const rooms = new Rooms();
  const { room } = rooms.createRoom('harry', { ...cfg, length: 'match' });
  rooms.join(room.code, 'gus');
  rooms.start(room, () => 0.42);
  const game = room.game;
  const seq = room.seq;

  expect(() => rooms.act(room, room.players[0].token, { type: 'nextHand' })).toThrow();
  expect(room.game).toBe(game);
  expect(room.seq).toBe(seq);
});
