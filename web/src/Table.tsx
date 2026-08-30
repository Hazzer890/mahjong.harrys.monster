import { useState } from 'react';
import type { GameConn } from './useGame';
import type { View } from '../../server/protocol';
import type { ClaimType } from '../../engine/game';
import { addedGongOptions, concealedGongOptions } from '../../engine/hand';
import type { Tile } from '../../engine/tiles';
import Seat from './Seat';
import { TileFace, TileRow } from './tiles';

const WIND_NAMES: Record<string, string> = { E: 'East', S: 'South', W: 'West', N: 'North' };
const SEAT_COLORS = ['#2d6cdf', '#c5221f', '#188038', '#f4b400'];

export function seatPosition(offset: number, n: number): 'right' | 'top' | 'left' {
  if (n === 2) return 'top';
  return offset === 1 ? 'right' : offset === 2 ? 'top' : 'left';
}

export default function Table({ conn, view }: { conn: GameConn; view: View }) {
  const [selected, setSelected] = useState<number | null>(null);

  if (view.phase === 'paused') {
    const disconnected = view.seats.filter(s => !s.connected).map(s => s.name);
    return (
      <div className="overlay">
        <div className="overlay-panel">
          <h2>Paused</h2>
          <p>Waiting for {disconnected.join(', ')} to reconnect&hellip;</p>
        </div>
      </div>
    );
  }

  const game = view.game;
  if (!game) return null;
  const n = view.seats.length;
  const you = view.you;
  const me = view.seats[you];
  const isMyTurn = view.phase === 'discard' && game.turn === you;

  function discard(i: number) {
    if (selected === i) {
      conn.send({ t: 'action', action: { type: 'discard', tile: game!.hand[i] } });
      setSelected(null);
    } else {
      setSelected(i);
    }
  }

  function selfAction(action: 'win' | 'concealedGong' | 'addedGong', tile?: Tile) {
    conn.send({ t: 'action', action: { type: 'selfAction', action, tile } });
  }

  function claim(claim: ClaimType, tiles?: Tile[]) {
    conn.send({ t: 'action', action: { type: 'claim', claim, tiles } });
  }

  const justDrewIdx = game.justDrew === null ? -1 : game.hand.indexOf(game.justDrew);
  const handIdx = game.hand.map((_, i) => i).filter(i => i !== justDrewIdx);

  const cGongs = isMyTurn ? concealedGongOptions(game.hand) : [];
  const aGongs = isMyTurn ? addedGongOptions(game.hand, me.melds) : [];

  return (
    <div className="table">
      <div className="table-info-col">
        {conn.error && <div className="error-strip">{conn.error}</div>}
        {game.robbing && (
          <div className="rob-banner">
            Robbing the kong: seat {game.robbing.seat} discarded <TileFace t={game.robbing.tile} size="sm" />
          </div>
        )}
        <div className="table-info">
          Wall {game.wallCount} &middot; {WIND_NAMES[game.roundWind]} round &middot; Turn: {view.seats[game.turn]?.name}
        </div>
      </div>

      {view.seats.map((seat, i) => {
        if (i === you) return null;
        const offset = (i - you + n) % n;
        return (
          <Seat
            key={i}
            seat={seat}
            seatIndex={i}
            dealer={game.dealer}
            n={n}
            isTurn={i === game.turn}
            position={seatPosition(offset, n)}
          />
        );
      })}

      <div className="center-area">
        {view.seats.map((seat, i) => (
          <div className="discard-pile" key={i} style={{ borderColor: SEAT_COLORS[i % SEAT_COLORS.length] }}>
            {seat.discards.map((t, j) => (
              <TileFace
                key={j} t={t} size="sm"
                selected={game.lastDiscard?.seat === i && j === seat.discards.length - 1}
              />
            ))}
          </div>
        ))}
      </div>

      <div className={`seat seat--bottom${isMyTurn ? ' seat--turn' : ''}`}>
        <div className="seat-header">
          <span className="seat-name">{me.name} (you)</span>
          <span className="seat-score">{me.score}</span>
        </div>
        <div className="hand-row">
          <div className="tile-row">
            {handIdx.map(i => (
              <TileFace
                key={i} t={game.hand[i]} size="lg" selected={selected === i}
                onClick={isMyTurn ? () => discard(i) : undefined}
              />
            ))}
          </div>
          {justDrewIdx !== -1 && (
            <div className="just-drew">
              <TileFace
                t={game.hand[justDrewIdx]} size="lg" selected={selected === justDrewIdx}
                onClick={isMyTurn ? () => discard(justDrewIdx) : undefined}
              />
            </div>
          )}
        </div>
        {me.melds.length > 0 && (
          <div className="melds">
            {me.melds.map((meld, i) => <TileRow key={i} tiles={meld.tiles} size="sm" />)}
          </div>
        )}
        {me.flowers.length > 0 && <TileRow tiles={me.flowers} size="sm" />}
      </div>

      {isMyTurn && (game.justDrew || cGongs.length > 0 || aGongs.length > 0) && (
        <div className="self-actions">
          {game.justDrew && <button type="button" onClick={() => selfAction('win')}>Win</button>}
          {cGongs.map(t => (
            <button key={`cg${t}`} type="button" onClick={() => selfAction('concealedGong', t)}>
              <TileFace t={t} size="sm" /> Gong
            </button>
          ))}
          {aGongs.map(t => (
            <button key={`ag${t}`} type="button" onClick={() => selfAction('addedGong', t)}>
              <TileFace t={t} size="sm" /> Gong
            </button>
          ))}
        </div>
      )}

      {game.prompt && (
        <div className="claim-bar">
          {game.prompt.options.includes('win') && <button type="button" onClick={() => claim('win')}>Win</button>}
          {game.prompt.options.includes('gong') && <button type="button" onClick={() => claim('gong')}>Gong</button>}
          {game.prompt.options.includes('pung') && <button type="button" onClick={() => claim('pung')}>Pung</button>}
          {game.prompt.options.includes('chow') && game.prompt.chowTiles.map((pair, i) => (
            <button key={i} type="button" onClick={() => claim('chow', pair)}>
              <TileRow tiles={pair} size="sm" />
            </button>
          ))}
          <button type="button" className="pass" onClick={() => conn.send({ t: 'action', action: { type: 'pass' } })}>
            Pass
          </button>
        </div>
      )}

      {(view.phase === 'handEnd' || view.phase === 'matchEnd') && game.result && (
        <div className="overlay">
          <div className="overlay-panel">
            <h2>{view.phase === 'matchEnd' ? 'Match over' : 'Hand over'}</h2>
            <pre>{JSON.stringify(game.result, null, 2)}</pre>
            {view.host && view.phase === 'handEnd' && (
              <button type="button" onClick={() => conn.send({ t: 'nextHand' })}>Next hand</button>
            )}
            {view.host && view.phase === 'matchEnd' && (
              <button type="button" onClick={() => conn.send({ t: 'rematch' })}>Rematch</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
