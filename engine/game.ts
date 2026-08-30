import { Tile, Wind, WINDS, buildWall, isFlower, sortTiles } from './tiles';
import { Meld, canGongDiscard, canPung, chowOptions } from './hand';
import { FaanItem, WinContext, scoreHand } from './faan';

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

export function newHand(
  config: RoomConfig,
  dealer: number,
  roundWind: Wind,
  scores: number[],
  rng: () => number,
  wall?: Tile[],
): GameState {
  const state: GameState = {
    config, roundWind, dealer, turn: dealer, phase: 'discard',
    seats: Array.from({ length: config.seats }, (_, i) => ({
      hand: [], melds: [], flowers: [], discards: [], score: scores[i] ?? 0,
    })),
    wall: wall ?? buildWall(rng), lastDiscard: null, pending: null, robbing: null,
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

function winContext(state: GameState, seat: number, selfDraw: boolean, robbingGong = false): WinContext {
  const wind = seatWind(state, seat);
  return {
    seatWind: wind,
    roundWind: state.roundWind,
    flowers: state.seats[seat].flowers,
    seatWindIndex: WINDS.indexOf(wind),
    selfDraw,
    robbingGong,
    lastTile: state.wall.length === 0,
    replacementDraw: selfDraw && state.replacementDraw,
    heavenly: selfDraw && seat === state.dealer && !state.anyDiscard && !state.anyCall,
    earthly: !selfDraw
      && state.lastDiscard?.seat === state.dealer
      && !state.anyCall
      && state.seats.every((s, i) => i === state.dealer
        ? s.discards.length <= 1
        : s.discards.length === 0),
  };
}

function endHand(
  state: GameState,
  winner: number | null,
  loser: number | null,
  winTile?: Tile,
) {
  state.phase = 'handEnd';
  state.result = { winner, loser, payments: state.seats.map(() => 0), winTile };
}

function advanceTurn(state: GameState) {
  state.turn = (state.turn + 1) % state.config.seats;
  state.pending = null;
  state.justDrew = null;
  state.replacementDraw = false;

  const tile = drawTile(state, state.turn);
  if (tile === null) {
    endHand(state, null, null);
    return;
  }

  state.seats[state.turn].hand.push(tile);
  state.seats[state.turn].hand = sortTiles(state.seats[state.turn].hand);
  state.justDrew = tile;
  state.phase = 'discard';
}

function openClaims(state: GameState) {
  const discarded = state.lastDiscard!;
  const pending: (PendingClaim | null)[] = state.seats.map((seat, claimSeat) => {
    if (claimSeat === discarded.seat) return null;

    const options: ClaimType[] = [];
    const score = scoreHand(
      [...seat.hand, discarded.tile],
      seat.melds,
      winContext(state, claimSeat, false),
    );
    if (score && score.faan >= state.config.minFaan) options.push('win');
    if (canGongDiscard(seat.hand, discarded.tile)) options.push('gong');
    if (canPung(seat.hand, discarded.tile)) options.push('pung');

    const chowTiles = claimSeat === (discarded.seat + 1) % state.config.seats
      ? chowOptions(seat.hand, discarded.tile)
      : [];
    if (chowTiles.length > 0) options.push('chow');

    return options.length > 0 ? { options, chowTiles, response: null } : null;
  });

  if (pending.every(claim => claim === null)) {
    advanceTurn(state);
    return;
  }

  state.pending = pending;
  state.phase = 'claims';
}

function removeTiles(hand: Tile[], tiles: Tile[]) {
  for (const tile of tiles) {
    const index = hand.indexOf(tile);
    if (index === -1) throw new GameError('claimed tiles are no longer in hand');
    hand.splice(index, 1);
  }
}

function removeClaimedDiscard(state: GameState, seat: number, tile: Tile) {
  const discards = state.seats[seat].discards;
  const index = discards.lastIndexOf(tile);
  if (index !== -1) discards.splice(index, 1);
}

function claimDistance(state: GameState, seat: number, discarder: number) {
  return (seat - discarder + state.config.seats) % state.config.seats;
}

function resolveClaims(state: GameState) {
  const discarded = state.lastDiscard!;
  const responses = state.pending!
    .map((pending, seat) => ({ seat, pending, response: pending?.response }))
    .filter((entry): entry is {
      seat: number;
      pending: PendingClaim;
      response: { claim: ClaimType; tiles?: Tile[] };
    } => entry.response !== null && entry.response !== undefined && entry.response !== 'pass')
    .sort((a, b) => claimDistance(state, a.seat, discarded.seat)
      - claimDistance(state, b.seat, discarded.seat));

  const winning = responses.find(entry => entry.response.claim === 'win');
  if (winning) {
    removeClaimedDiscard(state, discarded.seat, discarded.tile);
    state.pending = null;
    endHand(state, winning.seat, discarded.seat, discarded.tile);
    return;
  }

  const setClaim = responses.find(entry =>
    entry.response.claim === 'gong' || entry.response.claim === 'pung');
  if (setClaim) {
    const kind = setClaim.response.claim as 'gong' | 'pung';
    const hand = state.seats[setClaim.seat].hand;
    const copies = Array.from({ length: kind === 'gong' ? 3 : 2 }, () => discarded.tile);
    removeTiles(hand, copies);
    state.seats[setClaim.seat].melds.push({
      kind,
      tiles: [...copies, discarded.tile],
      from: discarded.seat,
    });
    removeClaimedDiscard(state, discarded.seat, discarded.tile);
    state.anyCall = true;
    state.turn = setClaim.seat;
    state.pending = null;
    state.justDrew = null;
    state.replacementDraw = false;

    if (kind === 'gong') {
      const tile = drawTile(state, setClaim.seat, true);
      if (tile === null) {
        endHand(state, null, null);
        return;
      }
      hand.push(tile);
      state.seats[setClaim.seat].hand = sortTiles(hand);
      state.justDrew = tile;
      state.replacementDraw = true;
    }
    state.phase = 'discard';
    return;
  }

  const chow = responses.find(entry => entry.response.claim === 'chow');
  if (chow) {
    const chosen = chow.pending.chowTiles.find(option =>
      option.length === chow.response.tiles?.length
      && option.every((tile, i) => tile === chow.response.tiles![i]))!;
    removeTiles(state.seats[chow.seat].hand, chosen);
    state.seats[chow.seat].melds.push({
      kind: 'chow',
      tiles: sortTiles([discarded.tile, ...chosen]),
      from: discarded.seat,
    });
    removeClaimedDiscard(state, discarded.seat, discarded.tile);
    state.anyCall = true;
    state.turn = chow.seat;
    state.pending = null;
    state.justDrew = null;
    state.replacementDraw = false;
    state.phase = 'discard';
    return;
  }

  advanceTurn(state);
}

function validateClaim(state: GameState, action: Extract<Action, { type: 'claim' }>) {
  if (state.phase !== 'claims' || state.pending === null || state.lastDiscard === null)
    throw new GameError('no claims are pending');

  const pending = state.pending[action.seat];
  if (!pending || pending.response !== null) throw new GameError('seat cannot respond to this discard');
  if (!pending.options.includes(action.claim)) throw new GameError('claim is not available');

  if (action.claim === 'chow') {
    const matches = pending.chowTiles.some(option =>
      option.length === action.tiles?.length
      && option.every((tile, i) => tile === action.tiles![i]));
    if (!matches) throw new GameError('chow tiles are not available');
  }

  if (action.claim === 'win') {
    const score = scoreHand(
      [...state.seats[action.seat].hand, state.lastDiscard.tile],
      state.seats[action.seat].melds,
      winContext(state, action.seat, false),
    );
    if (!score || score.faan < state.config.minFaan) throw new GameError('winning claim is not valid');
  }

  return pending;
}

function allClaimsAnswered(state: GameState) {
  return state.pending!.every(pending => pending === null || pending.response !== null);
}

export function applyAction(state: GameState, action: Action): GameState {
  if (action.type === 'discard') {
    if (state.phase !== 'discard') throw new GameError('cannot discard in this phase');
    if (action.seat !== state.turn) throw new GameError('seat is not on turn');
    const tileIndex = state.seats[action.seat].hand.indexOf(action.tile);
    if (tileIndex === -1) throw new GameError('tile is not in hand');

    state.seats[action.seat].hand.splice(tileIndex, 1);
    state.seats[action.seat].discards.push(action.tile);
    state.lastDiscard = { seat: action.seat, tile: action.tile };
    state.justDrew = null;
    state.replacementDraw = false;
    state.anyDiscard = true;
    openClaims(state);
    return state;
  }

  if (action.type === 'claim') {
    const pending = validateClaim(state, action);
    pending.response = { claim: action.claim, tiles: action.tiles };
    if (allClaimsAnswered(state)) resolveClaims(state);
    return state;
  }

  if (action.type === 'pass') {
    if (state.phase !== 'claims' || state.pending === null)
      throw new GameError('no claims are pending');
    const pending = state.pending[action.seat];
    if (!pending || pending.response !== null) throw new GameError('seat cannot respond to this discard');

    pending.response = 'pass';
    if (allClaimsAnswered(state)) resolveClaims(state);
    return state;
  }

  throw new GameError('self actions are not implemented');
}
