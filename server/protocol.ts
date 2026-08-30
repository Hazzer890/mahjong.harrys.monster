import type {
  ClaimType,
  HandResult,
  RoomConfig,
} from '../engine/game';
import type { Meld } from '../engine/hand';
import type { Tile, Wind } from '../engine/tiles';
import type { Room } from './rooms';

export type ClientMsg =
  | { t: 'create'; name: string; config: RoomConfig; wallSeed?: number }
  | { t: 'join'; code: string; name: string; token?: string }
  | { t: 'start' }
  | { t: 'rematch' }
  | { t: 'nextHand' }
  | {
      t: 'action';
      action: {
        type: string;
        tile?: string;
        claim?: string;
        tiles?: string[];
        action?: string;
      };
    };

export interface SeatView {
  name: string;
  connected: boolean;
  handCount: number;
  melds: Meld[];
  flowers: Tile[];
  discards: Tile[];
  score: number;
}

export interface View {
  code: string;
  config: RoomConfig;
  you: number;
  host: boolean;
  phase: 'lobby' | 'paused' | 'discard' | 'claims' | 'handEnd' | 'matchEnd';
  seats: SeatView[];
  game: null | {
    hand: Tile[];
    justDrew: Tile | null;
    wallCount: number;
    dealer: number;
    roundWind: Wind;
    turn: number;
    lastDiscard: { seat: number; tile: Tile } | null;
    robbing: { seat: number; tile: Tile } | null;
    prompt: null | { options: ClaimType[]; chowTiles: Tile[][] };
    result: HandResult | null;
  };
}

export type ServerMsg =
  | { t: 'joined'; code: string; token: string; seat: number }
  | { t: 'snapshot'; seq: number; view: View }
  | { t: 'error'; reason: string };

export function buildView(room: Room, seat: number): View {
  const game = room.game;
  const phase: View['phase'] = game === null
    ? 'lobby'
    : room.players.some(player => !player.connected)
      ? 'paused'
      : game.phase;

  const seats = room.players.map((player): SeatView => {
    const state = game?.seats[player.seat];
    return {
      name: player.name,
      connected: player.connected,
      handCount: state?.hand.length ?? 0,
      melds: player.seat === seat
        ? state?.melds ?? []
        : (state?.melds ?? []).map(meld => meld.kind === 'concealedGong'
          ? { ...meld, tiles: [] }
          : meld),
      flowers: state?.flowers ?? [],
      discards: state?.discards ?? [],
      score: state?.score ?? 0,
    };
  });

  if (game === null) {
    return {
      code: room.code,
      config: room.config,
      you: seat,
      host: room.players[seat]?.token === room.hostToken,
      phase,
      seats,
      game: null,
    };
  }

  const pending = game.pending?.[seat];
  const prompt = pending?.response === null
    ? { options: pending.options, chowTiles: pending.chowTiles }
    : null;
  const hasResult = game.phase === 'handEnd' || game.phase === 'matchEnd';

  return {
    code: room.code,
    config: room.config,
    you: seat,
    host: room.players[seat]?.token === room.hostToken,
    phase,
    seats,
    game: {
      hand: game.seats[seat].hand,
      justDrew: game.turn === seat ? game.justDrew : null,
      wallCount: game.wall.length,
      dealer: game.dealer,
      roundWind: game.roundWind,
      turn: game.turn,
      lastDiscard: game.lastDiscard,
      robbing: game.robbing,
      prompt,
      result: hasResult ? game.result : null,
    },
  };
}
