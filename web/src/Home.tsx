import { useState } from 'react';
import type { RoomConfig } from '../../engine/game';
import { parseRoomPath, type GameConn } from './useGame';

const LENGTHS: { value: RoomConfig['length']; label: string }[] = [
  { value: 'hand', label: 'Single hand' },
  { value: 'wind', label: 'One wind' },
  { value: 'match', label: 'Full game' },
];

export default function Home({ conn }: { conn: GameConn }) {
  const [createName, setCreateName] = useState('');
  const [seats, setSeats] = useState(4);
  const [length, setLength] = useState<RoomConfig['length']>('match');
  const [minFaan, setMinFaan] = useState(3);
  const [timer, setTimer] = useState(false);

  const [joinName, setJoinName] = useState('');
  const [code, setCode] = useState(parseRoomPath(location.pathname) ?? '');

  return (
    <div className="page">
      <h1>Mahjong</h1>
      {conn.error && <p className="error">{conn.error}</p>}

      <form
        className="panel"
        onSubmit={e => {
          e.preventDefault();
          conn.create(createName, { seats, length, minFaan, timer });
        }}
      >
        <h2>Create a room</h2>
        <label>
          Name
          <input value={createName} onChange={e => setCreateName(e.target.value)} maxLength={24} />
        </label>
        <label>
          Seats
          <select value={seats} onChange={e => setSeats(Number(e.target.value))}>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
        </label>
        <label>
          Length
          <select value={length} onChange={e => setLength(e.target.value as RoomConfig['length'])}>
            {LENGTHS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </label>
        <label>
          Minimum faan
          <input
            type="number" min={0} max={5} value={minFaan}
            onChange={e => setMinFaan(Number(e.target.value))}
          />
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={timer} onChange={e => setTimer(e.target.checked)} />
          Turn timer
        </label>
        <button type="submit" disabled={!createName.trim()}>Create</button>
      </form>

      <form
        className="panel"
        onSubmit={e => {
          e.preventDefault();
          conn.join(code.toUpperCase(), joinName);
        }}
      >
        <h2>Join a room</h2>
        <label>
          Room code
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={4} />
        </label>
        <label>
          Name
          <input value={joinName} onChange={e => setJoinName(e.target.value)} maxLength={24} />
        </label>
        <button type="submit" disabled={!joinName.trim() || code.length !== 4}>Join</button>
      </form>
    </div>
  );
}
