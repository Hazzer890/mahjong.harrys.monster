import { expect, test } from 'bun:test';
import type { ServerMsg, View } from './protocol';
import { startServer } from './index';

type Predicate = (message: ServerMsg) => boolean;

class TestClient {
  readonly ws: WebSocket;
  private messages: ServerMsg[] = [];
  private waiters: Array<{
    predicate: Predicate;
    resolve: (message: ServerMsg) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];

  private constructor(ws: WebSocket) {
    this.ws = ws;
    ws.addEventListener('message', event => {
      const message = JSON.parse(String(event.data)) as ServerMsg;
      const index = this.waiters.findIndex(waiter => waiter.predicate(message));
      if (index === -1) {
        this.messages.push(message);
        return;
      }
      const [waiter] = this.waiters.splice(index, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    });
  }

  static connect(url: string): Promise<TestClient> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const client = new TestClient(ws);
      ws.addEventListener('open', () => resolve(client), { once: true });
      ws.addEventListener('error', () => reject(new Error('websocket connection failed')), {
        once: true,
      });
    });
  }

  send(message: unknown): void {
    this.ws.send(JSON.stringify(message));
  }

  next<T extends ServerMsg>(
    predicate: (message: ServerMsg) => message is T,
    timeoutMs?: number,
  ): Promise<T>;
  next(predicate: Predicate, timeoutMs?: number): Promise<ServerMsg>;
  next(predicate: Predicate, timeoutMs = 2_000): Promise<ServerMsg> {
    const queued = this.messages.findIndex(predicate);
    if (queued !== -1) return Promise.resolve(this.messages.splice(queued, 1)[0]);

    return new Promise((resolve, reject) => {
      const waiter = {
        predicate,
        resolve,
        reject,
        timer: setTimeout(() => {
          const index = this.waiters.indexOf(waiter);
          if (index !== -1) this.waiters.splice(index, 1);
          reject(new Error('timed out waiting for websocket message'));
        }, timeoutMs),
      };
      this.waiters.push(waiter);
    });
  }

  take(predicate: Predicate): ServerMsg | undefined {
    const index = this.messages.findIndex(predicate);
    return index === -1 ? undefined : this.messages.splice(index, 1)[0];
  }

  close(): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.close();
  }
}

const isJoined = (message: ServerMsg): message is Extract<ServerMsg, { t: 'joined' }> =>
  message.t === 'joined';
const isSnapshot = (message: ServerMsg): message is Extract<ServerMsg, { t: 'snapshot' }> =>
  message.t === 'snapshot';
const isError = (message: ServerMsg): message is Extract<ServerMsg, { t: 'error' }> =>
  message.t === 'error';

test('websocket room flow filters views, authorizes hosts, and reconnects seats', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  const server = startServer(0);
  const clients: TestClient[] = [];

  try {
    const port = server.port;
    expect(typeof port).toBe('number');
    const baseUrl = `http://127.0.0.1:${port}`;
    const root = await fetch(baseUrl);
    expect(root.status).toBe(200);
    expect((await root.text()).length).toBeGreaterThan(0);

    const host = await TestClient.connect(`${baseUrl.replace('http', 'ws')}/ws`);
    const guest = await TestClient.connect(`${baseUrl.replace('http', 'ws')}/ws`);
    clients.push(host, guest);

    host.send({
      t: 'create',
      name: 'Harry',
      config: { seats: 2, length: 'wind', minFaan: 0, timer: false },
      wallSeed: 4788,
    });
    const hostJoined = await host.next(isJoined);
    expect(hostJoined.seat).toBe(0);
    const firstLobby = await host.next(isSnapshot);
    expect(firstLobby.view.phase).toBe('lobby');

    guest.send({ t: 'join', code: hostJoined.code, name: 'Gus' });
    const guestJoined = await guest.next(isJoined);
    expect(guestJoined.seat).toBe(1);
    const [hostLobby, guestLobby] = await Promise.all([
      host.next(isSnapshot),
      guest.next(isSnapshot),
    ]);
    expect(hostLobby.view.phase).toBe('lobby');
    expect(guestLobby.view.phase).toBe('lobby');

    guest.send({ t: 'start' });
    const unauthorized = await guest.next(isError);
    expect(unauthorized.reason).toMatch(/host/i);
    await Bun.sleep(75);
    expect(host.take(isSnapshot)).toBeUndefined();
    expect(guest.take(isSnapshot)).toBeUndefined();

    host.send({ t: 'start' });
    let latest = await Promise.all([host.next(isSnapshot), guest.next(isSnapshot)]);
    expect(latest[0].view.phase).toBe('discard');
    expect(latest[1].view.phase).toBe('discard');
    for (const snapshot of latest) {
      const game = snapshot.view.game!;
      expect(game.hand).toHaveLength(snapshot.view.you === game.dealer ? 14 : 13);
    }

    for (let actions = 0; actions < 400; actions++) {
      const view = latest[0].view;
      if (view.phase === 'handEnd' || view.phase === 'matchEnd') break;

      if (view.phase === 'discard') {
        const turn = view.game!.turn;
        const actor = latest.findIndex(snapshot => snapshot.view.you === turn);
        const tile = latest[actor].view.game!.hand[0];
        clients[actor].send({ t: 'action', action: { type: 'discard', tile } });
      } else {
        const actor = latest.findIndex(snapshot => snapshot.view.game?.prompt !== null);
        expect(actor).toBeGreaterThanOrEqual(0);
        clients[actor].send({ t: 'action', action: { type: 'pass' } });
      }

      latest = await Promise.all([host.next(isSnapshot), guest.next(isSnapshot)]);
    }

    expect(latest[0].view.phase).toBe('handEnd');
    expect(latest[0].view.game?.result).not.toBeNull();
    expect(latest[1].view.game?.result).toEqual(latest[0].view.game?.result);

    guest.send({ t: 'action', action: { type: 'nextHand' } });
    const unauthorizedNextHand = await guest.next(isError);
    expect(unauthorizedNextHand.reason).toMatch(/host/i);
    await Bun.sleep(75);
    expect(host.take(isSnapshot)).toBeUndefined();
    expect(guest.take(isSnapshot)).toBeUndefined();

    host.send({ t: 'nextHand' });
    latest = await Promise.all([host.next(isSnapshot), guest.next(isSnapshot)]);
    expect(latest[0].view.phase).toBe('discard');
    expect(latest[1].view.phase).toBe('discard');
    expect(latest[0].view.game?.result).toBeNull();
    expect(latest[1].view.game?.result).toBeNull();

    guest.close();
    const paused = await host.next(isSnapshot);
    expect(paused.view.phase).toBe('paused');

    const reconnected = await TestClient.connect(`${baseUrl.replace('http', 'ws')}/ws`);
    clients.push(reconnected);
    reconnected.send({
      t: 'join',
      code: hostJoined.code,
      name: 'ignored',
      token: guestJoined.token,
    });
    const rejoined = await reconnected.next(isJoined);
    expect(rejoined.seat).toBe(guestJoined.seat);
    const [hostResumed, guestResumed] = await Promise.all([
      host.next(isSnapshot),
      reconnected.next(isSnapshot),
    ]);
    expect(hostResumed.view.phase).not.toBe('paused');
    expect(guestResumed.view.phase).not.toBe('paused');
    expect(guestResumed.view.you).toBe(guestJoined.seat);

    reconnected.send({
      t: 'create',
      name: 'Gus',
      config: { seats: 2, length: 'hand', minFaan: 0, timer: false },
    });
    await reconnected.next(isJoined);
    const switchedRoom = await host.next(isSnapshot);
    expect(switchedRoom.view.phase).toBe('paused');
    expect(switchedRoom.view.seats[guestJoined.seat].connected).toBe(false);
  } finally {
    for (const client of clients) client.close();
    await server.stop(true);
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});
