import { useState } from 'react';
import type { GameConn } from './useGame';
import type { View } from '../../server/protocol';

export default function Lobby({ conn, view }: { conn: GameConn; view: View }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const link = `${location.origin}/r/${view.code}`;
  const full = view.seats.length === view.config.seats;

  return (
    <div className="page">
      <h1>Room {view.code}</h1>
      {conn.error && <p className="error">{conn.error}</p>}

      <div className="panel">
        <label>
          Share link
          <div className="share-row">
            <input readOnly value={link} />
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopyState('copied');
                } catch {
                  setCopyState('failed');
                }
                setTimeout(() => setCopyState('idle'), 1500);
              }}
            >
              {copyState === 'copied' ? 'Copied!' : copyState === 'failed' ? 'Copy failed' : 'Copy'}
            </button>
          </div>
        </label>
      </div>

      <ul className="panel seat-list">
        {view.seats.map((s, i) => (
          <li key={i}>
            <span className={`dot ${s.connected ? 'on' : 'off'}`} />
            {s.name} {i === view.you && '(You)'}
          </li>
        ))}
      </ul>

      <div className="panel">
        {view.host
          ? (
            <button type="button" disabled={!full} onClick={() => conn.send({ t: 'start' })}>
              Start
            </button>
            )
          : <p>Waiting for host to start&hellip;</p>}
      </div>
    </div>
  );
}
