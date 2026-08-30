import { useEffect, useRef, useState } from 'react';
import type { GameConn } from './useGame';
import type { View } from '../../server/protocol';
import type { ClaimType } from '../../engine/game';
import { addedGongOptions, concealedGongOptions } from '../../engine/hand';
import type { Tile } from '../../engine/tiles';
import Seat from './Seat';
import Timer from './Timer';
import WinScreen from './WinScreen';
import { sounds } from './sounds';
import { TileFace, TileRow } from './tiles';

const WIND_NAMES: Record<string, string> = { E: 'East', S: 'South', W: 'West', N: 'North' };
const WIND_GLYPHS: Record<string, string> = { E: '東', S: '南', W: '西', N: '北' };

export function seatPosition(offset: number, n: number): 'right' | 'top' | 'left' {
  if (n === 2) return 'top';
  return offset === 1 ? 'right' : offset === 2 ? 'top' : 'left';
}

// Sound is driven by diffing snapshots: the server never tells us "a tile landed",
// only what the table looks like now, so the previous view is the only event source.
function useTableSounds(view: View): void {
  const previous = useRef<View | null>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = view;
    if (!before?.game || !view.game || before.code !== view.code) return;

    const discarded = view.seats.some(
      (seat, i) => seat.discards.length > (before.seats[i]?.discards.length ?? 0),
    );
    if (discarded || view.game.hand.length > before.game.hand.length) sounds.clack();

    for (const [i, seat] of view.seats.entries()) {
      if (seat.melds.length <= (before.seats[i]?.melds.length ?? 0)) continue;
      const kind = seat.melds[seat.melds.length - 1].kind;
      sounds.sting(kind === 'chow' || kind === 'pung' ? 'pung' : 'gong');
    }

    const ended = view.phase === 'handEnd' || view.phase === 'matchEnd';
    const wasPlaying = before.phase === 'discard' || before.phase === 'claims';
    if (ended && wasPlaying && view.game.result?.winner !== null) sounds.sting('win');
  }, [view]);
}

export default function Table({ conn, view }: { conn: GameConn; view: View }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [muted, setMuted] = useState(() => sounds.muted);

  useTableSounds(view);

  // The hand array is reassigned whenever it actually changes (draw, discard, gong,
  // or a brand new hand) — never merely because it's now someone else's turn — so a
  // tile selected earlier (this turn, a prior turn, or a prior hand) can't survive
  // to be discarded by a single stray tap on the newly-rendered hand.
  useEffect(() => {
    setSelected(null);
  }, [view.game?.hand]);

  // A paused room can already hold a finished hand: the pause is the more urgent
  // fact, so it replaces the scoring slip until everyone is back.
  if (view.phase === 'paused') {
    const disconnected = view.seats.filter(s => !s.connected).map(s => s.name);
    return (
      <div className="overlay">
        <div className="slip slip--notice">
          <p className="slip-eyebrow">Paused</p>
          <h2 className="slip-title">Hold on</h2>
          <p className="slip-sub">Waiting for {disconnected.join(', ')} to reconnect&hellip;</p>
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
  const playing = view.phase === 'discard' || view.phase === 'claims';
  const timed = view.config.timer && playing;

  function discard(i: number) {
    if (selected === i) {
      conn.send({ t: 'action', action: { type: 'discard', tile: game!.hand[i] } });
      setSelected(null);
    } else {
      setSelected(i);
    }
  }

  function selfAction(action: 'win' | 'concealedGong' | 'addedGong', tile?: Tile) {
    setSelected(null);
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
      <div className="felt-mark" aria-hidden="true">{WIND_GLYPHS[game.roundWind]}</div>

      <div className="table-info-col">
        {conn.error && <div className="error-strip">{conn.error}</div>}
        {game.robbing && (
          <div className="rob-banner">
            Robbing the kong: {view.seats[game.robbing.seat]?.name ?? `seat ${game.robbing.seat}`} laid
            <TileFace t={game.robbing.tile} size="sm" />
          </div>
        )}
        <div className="table-info">
          <span className="info-item">Wall <span className="num">{game.wallCount}</span></span>
          <span className="info-sep" aria-hidden="true">·</span>
          <span className="info-item">{WIND_NAMES[game.roundWind]} round</span>
          <span className="info-right">
            {playing && (
              <span className="info-turn">
                {timed && <Timer key={`${game.turn}-${view.phase}`} />}
                {view.phase === 'claims'
                  ? 'Claims open'
                  : game.turn === you ? 'Your turn' : `${view.seats[game.turn]?.name} to play`}
              </span>
            )}
            <button
              type="button"
              className="ghost mute-toggle"
              aria-pressed={muted}
              onClick={() => { sounds.toggle(); setMuted(sounds.muted); }}
            >
              {muted ? 'Sound off' : 'Sound on'}
            </button>
          </span>
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
          <div className={`discard-pile${game.turn === i ? ' discard-pile--turn' : ''}`} key={i}>
            <span className="pile-label">{i === you ? 'You' : seat.name}</span>
            <div className="pile-tiles">
              {seat.discards.map((t, j) => (
                <TileFace
                  key={j} t={t} size="sm"
                  selected={game.lastDiscard?.seat === i && j === seat.discards.length - 1}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={`seat seat--bottom${isMyTurn ? ' seat--turn' : ''}`}>
        <div className="seat-header">
          <span className="seat-name">{me.name} (you)</span>
          <span className="seat-score num">{me.score}</span>
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
        <WinScreen conn={conn} view={view} />
      )}
    </div>
  );
}
