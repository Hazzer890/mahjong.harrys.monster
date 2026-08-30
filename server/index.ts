import type { Room } from './rooms';
import { Rooms } from './rooms';
import { buildView, type ClientMsg, type ServerMsg } from './protocol';

interface SocketData {
  code: string;
  token: string;
}

const distUrl = new URL('../web/dist/', import.meta.url);
const indexUrl = new URL('index.html', distUrl);

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

async function serveStatic(pathname: string): Promise<Response> {
  const indexFile = Bun.file(indexUrl);
  if (!(await indexFile.exists())) {
    return new Response('HK Mahjong server', {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  if (pathname === '/' || pathname === '/r' || pathname.startsWith('/r/'))
    return new Response(indexFile);

  try {
    const decoded = decodeURIComponent(pathname).replace(/^\/+/, '');
    const fileUrl = new URL(decoded, distUrl);
    if (fileUrl.href.startsWith(distUrl.href)) {
      const file = Bun.file(fileUrl);
      if (await file.exists()) return new Response(file);
    }
  } catch {
    // Invalid paths use the same SPA fallback as missing files.
  }

  return new Response(indexFile);
}

export function startServer(port: number): ReturnType<typeof Bun.serve> {
  const rooms = new Rooms();
  const sockets = new Map<string, Bun.ServerWebSocket<SocketData>>();

  const send = (ws: Bun.ServerWebSocket<SocketData>, message: ServerMsg): void => {
    ws.send(JSON.stringify(message));
  };

  const broadcast = (room: Room): void => {
    for (const player of room.players) {
      if (!player.connected) continue;
      const socket = sockets.get(player.token);
      if (socket?.data.code !== room.code) continue;
      send(socket, {
        t: 'snapshot',
        seq: room.seq,
        view: buildView(room, player.seat),
      });
    }
  };

  const attach = (
    ws: Bun.ServerWebSocket<SocketData>,
    room: Room,
    token: string,
  ): void => {
    if (ws.data.token && sockets.get(ws.data.token) === ws) sockets.delete(ws.data.token);
    const replaced = sockets.get(token);
    ws.data = { code: room.code, token };
    sockets.set(token, ws);
    if (replaced && replaced !== ws) replaced.close(1000, 'reconnected');
  };

  const currentRoom = (ws: Bun.ServerWebSocket<SocketData>): Room => {
    if (!ws.data.code || !ws.data.token) throw new Error('join a room first');
    const room = rooms.get(ws.data.code);
    if (!room) throw new Error('room not found');
    return room;
  };

  const requireHost = (ws: Bun.ServerWebSocket<SocketData>, room: Room): void => {
    if (ws.data.token !== room.hostToken) throw new Error('only the host can do that');
  };

  const server = Bun.serve<SocketData>({
    port,
    async fetch(request, server) {
      const url = new URL(request.url);
      if (url.pathname === '/ws') {
        if (server.upgrade(request, { data: { code: '', token: '' } })) return;
        return new Response('WebSocket upgrade failed', { status: 400 });
      }
      return serveStatic(url.pathname);
    },
    websocket: {
      data: {} as SocketData,
      message(ws, data) {
        try {
          const text = typeof data === 'string' ? data : data.toString();
          const message = JSON.parse(text) as ClientMsg;

          if (message.t === 'create') {
            const { room, player } = rooms.createRoom(message.name, message.config);
            if (process.env.NODE_ENV === 'test'
              && typeof message.wallSeed === 'number'
              && Number.isFinite(message.wallSeed)) room.wallSeed = message.wallSeed;
            attach(ws, room, player.token);
            send(ws, { t: 'joined', code: room.code, token: player.token, seat: player.seat });
            broadcast(room);
            return;
          }

          if (message.t === 'join') {
            const { room, player } = rooms.join(message.code, message.name, message.token);
            attach(ws, room, player.token);
            send(ws, { t: 'joined', code: room.code, token: player.token, seat: player.seat });
            broadcast(room);
            return;
          }

          const room = currentRoom(ws);
          if (message.t === 'start') {
            requireHost(ws, room);
            rooms.start(room, room.wallSeed === undefined ? Math.random : mulberry32(room.wallSeed));
          } else if (message.t === 'rematch') {
            requireHost(ws, room);
            rooms.rematch(room, room.wallSeed === undefined ? undefined : mulberry32(room.wallSeed));
          } else if (message.t === 'nextHand') {
            requireHost(ws, room);
            rooms.act(room, ws.data.token, { type: 'nextHand' });
          } else if (message.t === 'action') {
            rooms.act(room, ws.data.token, message.action as Parameters<Rooms['act']>[2]);
          } else {
            throw new Error('unknown message type');
          }
          broadcast(room);
        } catch (error) {
          send(ws, {
            t: 'error',
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      },
      close(ws) {
        if (!ws.data.code || !ws.data.token || sockets.get(ws.data.token) !== ws) return;
        sockets.delete(ws.data.token);
        try {
          rooms.disconnect(ws.data.code, ws.data.token);
          const room = rooms.get(ws.data.code);
          if (room) broadcast(room);
        } catch {
          // The room may already have expired during a sweep.
        }
      },
    },
  });

  const sweepTimer = setInterval(() => rooms.sweep(Date.now()), 600_000);
  sweepTimer.unref();
  return server;
}

if (import.meta.main) startServer(Number(process.env.PORT) || 3000);
