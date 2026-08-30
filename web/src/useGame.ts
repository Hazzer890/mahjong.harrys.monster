import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMsg, ServerMsg, View } from '../../server/protocol';
import type { RoomConfig } from '../../engine/game';

const STORAGE_KEY = 'mahjong';

interface Stored { code: string; token: string; name: string }

export function wsUrl(loc: { protocol: string; host: string }): string {
  const scheme = loc.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${loc.host}/ws`;
}

export function shouldApply(lastSeq: number, incoming: number): boolean {
  return incoming >= lastSeq;
}

export function parseRoomPath(path: string): string | null {
  const match = /^\/r\/([A-Za-z0-9]{4})$/.exec(path);
  return match ? match[1].toUpperCase() : null;
}

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function writeStored(value: Stored): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export interface GameConn {
  view: View | null;
  seat: number | null;
  error: string | null;
  connected: boolean;
  create(name: string, config: RoomConfig): void;
  join(code: string, name: string): void;
  send(msg: ClientMsg): void;
}

export function useGame(): GameConn {
  const [view, setView] = useState<View | null>(null);
  const [seat, setSeat] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const lastSeqRef = useRef(0);
  const nameRef = useRef('');
  const backoffRef = useRef(1000);
  const unmountedRef = useRef(false);

  const send = useCallback((msg: ClientMsg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(msg));
  }, []);

  useEffect(() => {
    unmountedRef.current = false;

    function connect(isInitial: boolean) {
      const ws = new WebSocket(wsUrl(location));
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        backoffRef.current = 1000;
        const stored = readStored();
        if (!stored) return;
        const pathCode = parseRoomPath(location.pathname);
        const resume = isInitial ? pathCode === stored.code : true;
        if (!resume) return;
        nameRef.current = stored.name;
        ws.send(JSON.stringify(
          { t: 'join', code: stored.code, name: stored.name, token: stored.token } satisfies ClientMsg,
        ));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data) as ServerMsg;
        if (msg.t === 'joined') {
          setSeat(msg.seat);
          writeStored({ code: msg.code, token: msg.token, name: nameRef.current });
        } else if (msg.t === 'snapshot') {
          if (shouldApply(lastSeqRef.current, msg.seq)) {
            lastSeqRef.current = msg.seq;
            setView(msg.view);
            setError(null);
          }
        } else if (msg.t === 'error') {
          setError(msg.reason);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (unmountedRef.current) return;
        const delay = backoffRef.current;
        backoffRef.current = Math.min(delay * 2, 10000);
        setTimeout(() => connect(false), delay);
      };
    }

    connect(true);
    return () => {
      unmountedRef.current = true;
      wsRef.current?.close();
    };
  }, []);

  const create = useCallback((name: string, config: RoomConfig) => {
    nameRef.current = name;
    send({ t: 'create', name, config });
  }, [send]);

  const join = useCallback((code: string, name: string) => {
    nameRef.current = name;
    send({ t: 'join', code, name });
  }, [send]);

  return { view, seat, error, connected, create, join, send };
}
