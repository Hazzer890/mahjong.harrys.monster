import { test, expect } from 'bun:test';
import { newHand, seatWind, RoomConfig } from './game';

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
