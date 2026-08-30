import { Tile, Wind, WINDS, buildWall, isFlower, sortTiles } from './tiles';
import { Meld } from './hand';
import { FaanItem } from './faan';

export interface RoomConfig { seats: number; length: 'hand'|'wind'|'match'; minFaan: number; timer: boolean }
export interface SeatState { hand: Tile[]; melds: Meld[]; flowers: Tile[]; discards: Tile[]; score: number }
export type ClaimType = 'win'|'gong'|'pung'|'chow';
export interface PendingClaim { options: ClaimType[]; chowTiles: Tile[][]; response: null|'pass'|{ claim: ClaimType; tiles?: Tile[] } }
export interface HandResult {
  winner: number|null; loser: number|null; faan?: number; items?: FaanItem[];
  payments: number[]; winTile?: Tile; winningConcealed?: Tile[]; winningMelds?: Meld[];
}
export interface GameState {
  config: RoomConfig; seats: SeatState[]; wall: Tile[];
  dealer: number; roundWind: Wind; turn: number;
  phase: 'discard'|'claims'|'handEnd'|'matchEnd';
  lastDiscard: { seat: number; tile: Tile }|null;
  pending: (PendingClaim|null)[]|null;
  robbing: { seat: number; tile: Tile }|null;
  justDrew: Tile|null; replacementDraw: boolean;
  anyDiscard: boolean; anyCall: boolean;
  result: HandResult|null;
}
export type Action =
  | { type: 'discard'; seat: number; tile: Tile }
  | { type: 'selfAction'; seat: number; action: 'win'|'concealedGong'|'addedGong'; tile?: Tile }
  | { type: 'claim'; seat: number; claim: ClaimType; tiles?: Tile[] }
  | { type: 'pass'; seat: number };
export class GameError extends Error {}

export function seatWind(state: GameState, seat: number): Wind {
  const n = state.config.seats;
  return WINDS[(seat - state.dealer + n) % n];
}

function drawTile(state: GameState, seat: number, replacement = false): Tile | null {
  while (true) {
    const t = replacement ? state.wall.pop() : state.wall.shift();
    if (t === undefined) return null;
    if (isFlower(t)) { state.seats[seat].flowers.push(t); replacement = true; continue; }
    return t;
  }
}

export function newHand(config: RoomConfig, dealer: number, roundWind: Wind, scores: number[], rng: () => number): GameState {
  const state: GameState = {
    config, roundWind, dealer, turn: dealer, phase: 'discard',
    seats: Array.from({ length: config.seats }, (_, i) => ({
      hand: [], melds: [], flowers: [], discards: [], score: scores[i] ?? 0,
    })),
    wall: buildWall(rng), lastDiscard: null, pending: null, robbing: null,
    justDrew: null, replacementDraw: false, anyDiscard: false, anyCall: false, result: null,
  };
  for (let round = 0; round < 13; round++)
    for (let i = 0; i < config.seats; i++) {
      const seat = (dealer + i) % config.seats;
      state.seats[seat].hand.push(drawTile(state, seat)!);
    }
  const fourteenth = drawTile(state, dealer)!;
  state.seats[dealer].hand.push(fourteenth);
  state.justDrew = fourteenth;
  for (const s of state.seats) s.hand = sortTiles(s.hand);
  return state;
}

export function applyAction(_state: GameState, _action: Action): GameState {
  throw new GameError('not implemented');
}
