import {
  applyAction,
  newHand,
  nextHand,
  type Action,
  type GameState,
  type RoomConfig,
} from '../engine/game';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const ROOM_TTL_MS = 6 * 60 * 60 * 1_000;

type RoomAction =
  | (Omit<Action, 'seat'> & { type: Action['type'] } & Record<string, unknown>)
  | ({ type: 'nextHand' } & Record<string, unknown>);

export interface Player {
  token: string;
  name: string;
  seat: number;
  connected: boolean;
}

export interface Room {
  code: string;
  config: RoomConfig;
  players: Player[];
  hostToken: string;
  game: GameState | null;
  lastActivity: number;
  seq: number;
  rng: () => number;
  wallSeed?: number;
}

export class Rooms {
  private rooms = new Map<string, Room>();

  createRoom(name: string, config: RoomConfig): { room: Room; player: Player } {
    const validatedName = this.validateName(name);
    this.validateConfig(config);

    const player: Player = {
      token: crypto.randomUUID(),
      name: validatedName,
      seat: 0,
      connected: true,
    };
    const room: Room = {
      code: this.createCode(),
      config: { ...config },
      players: [player],
      hostToken: player.token,
      game: null,
      lastActivity: 0,
      seq: 0,
      rng: Math.random,
    };

    this.rooms.set(room.code, room);
    this.touch(room);
    return { room, player };
  }

  join(code: string, name: string, token?: string): { room: Room; player: Player } {
    const validatedName = this.validateName(name);
    const room = this.rooms.get(code);
    if (!room) throw new Error('room not found');

    const reconnecting = token === undefined
      ? undefined
      : room.players.find(player => player.token === token);
    if (reconnecting) {
      reconnecting.connected = true;
      this.touch(room);
      return { room, player: reconnecting };
    }

    if (room.game !== null) throw new Error('game already started');
    if (room.players.length >= room.config.seats) throw new Error('room is full');

    const player: Player = {
      token: crypto.randomUUID(),
      name: validatedName,
      seat: room.players.length,
      connected: true,
    };
    room.players.push(player);
    this.touch(room);
    return { room, player };
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  start(room: Room, rng: () => number = Math.random): void {
    if (room.game !== null) throw new Error('game already started');
    if (room.players.length !== room.config.seats)
      throw new Error('room does not have the required players');

    const dealer = Math.floor(rng() * room.config.seats);
    const game = newHand(
      room.config,
      dealer,
      'E',
      Array.from({ length: room.config.seats }, () => 0),
      rng,
    );
    room.rng = rng;
    room.game = game;
    this.touch(room);
  }

  act(room: Room, token: string, action: RoomAction, rng?: () => number): void {
    const player = room.players.find(candidate => candidate.token === token);
    if (!player) throw new Error('unknown player token');
    if (room.game === null) throw new Error('game has not started');
    if (room.players.some(candidate => !candidate.connected))
      throw new Error('room is paused while a player is disconnected');
    if (room.game.phase === 'matchEnd') throw new Error('match is over');

    if (action.type === 'nextHand') {
      const actionRng = rng ?? room.rng;
      room.game = nextHand(room.game, actionRng);
      room.rng = actionRng;
    } else {
      room.game = applyAction(room.game, { ...action, seat: player.seat } as Action);
    }

    this.touch(room);
  }

  rematch(room: Room, rng?: () => number): void {
    if (room.game?.phase !== 'matchEnd') throw new Error('match is not over');

    const rematchRng = rng ?? room.rng;
    const dealer = Math.floor(rematchRng() * room.config.seats);
    const game = newHand(
      room.config,
      dealer,
      'E',
      Array.from({ length: room.config.seats }, () => 0),
      rematchRng,
    );
    room.rng = rematchRng;
    room.game = game;
    this.touch(room);
  }

  disconnect(code: string, token: string): void {
    const room = this.rooms.get(code);
    if (!room) throw new Error('room not found');

    const player = room.players.find(candidate => candidate.token === token);
    if (!player) throw new Error('unknown player token');

    player.connected = false;
    this.touch(room);
  }

  sweep(now: number): void {
    for (const [code, room] of this.rooms) {
      if (now - room.lastActivity > ROOM_TTL_MS) this.rooms.delete(code);
    }
  }

  private createCode(): string {
    let code: string;
    do {
      code = Array.from(
        { length: 4 },
        () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
      ).join('');
    } while (this.rooms.has(code));
    return code;
  }

  private touch(room: Room): void {
    room.seq++;
    room.lastActivity = Date.now();
  }

  private validateName(name: string): string {
    if (typeof name !== 'string')
      throw new Error('name must be a string from 1 to 24 characters');
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 24)
      throw new Error('name must be a string from 1 to 24 characters');
    return trimmed;
  }

  private validateConfig(config: RoomConfig): void {
    if (!Number.isInteger(config.seats) || config.seats < 2 || config.seats > 4)
      throw new Error('seats must be an integer from 2 to 4');
    if (!Number.isInteger(config.minFaan) || config.minFaan < 0 || config.minFaan > 5)
      throw new Error('minFaan must be an integer from 0 to 5');
    if (!['hand', 'wind', 'match'].includes(config.length))
      throw new Error('invalid game length');
    if (typeof config.timer !== 'boolean') throw new Error('timer must be boolean');
  }
}
