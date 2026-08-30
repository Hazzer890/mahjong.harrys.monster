import { useState } from 'react';
import type { GameConn } from './useGame';
import type { View } from '../../server/protocol';

export default function Lobby({ conn, view }: { conn: GameConn; view: View }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const link = `${location.origin}/r/${view.code}`;
  const full = view.seats.length === view.config.seats;

  return (
    <div className="page">
      <p className="eyebrow">Room</p>
      <h1 className="room-code">{view.code}</h1>
      <p className="tagline">
        {view.seats.length} of {view.config.seats} seated · minimum {view.config.minFaan} faan
        {view.config.timer ? ' · 20s turn timer' : ''}
      </p>
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
        {Array.from({ length: view.config.seats }, (_, i) => {
          const seat = view.seats[i];
          if (!seat) return <li key={i} className="is-empty"><span className="dot off" />Empty seat</li>;
          return (
            <li key={i}>
              <span className={`dot ${seat.connected ? 'on' : 'off'}`} />
              {seat.name} {i === view.you && '(You)'}
            </li>
          );
        })}
      </ul>

      <div className="panel">
        {view.host
          ? (
            <button type="button" disabled={!full} onClick={() => conn.send({ t: 'start' })}>
              Start
            </button>
            )
          : <p className="muted-note">Waiting for the host to start&hellip;</p>}
      </div>
    </div>
  );
}
