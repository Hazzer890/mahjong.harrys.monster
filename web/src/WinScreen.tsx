import type { GameConn } from './useGame';
import type { View } from '../../server/protocol';
import { sortTiles } from '../../engine/tiles';
import { TileFace } from './tiles';

const MELD_LABELS: Record<string, string> = {
  chow: 'Chow',
  pung: 'Pung',
  gong: 'Gong',
  concealedGong: 'Concealed gong',
};

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

export default function WinScreen({ conn, view }: { conn: GameConn; view: View }) {
  const result = view.game?.result;
  if (!result) return null;

  const final = view.phase === 'matchEnd';
  const winner = result.winner === null ? null : view.seats[result.winner];
  // The engine sorts before storing, but the slip is the one place the hand is read
  // as a hand rather than played from, so sort defensively.
  const concealed = sortTiles(result.winningConcealed ?? []);
  const winIndex = result.winTile === undefined ? -1 : concealed.indexOf(result.winTile);
  const melds = result.winningMelds ?? [];
  const items = result.items ?? [];

  const best = Math.max(...view.seats.map(seat => seat.score));
  const champions = view.seats.filter(seat => seat.score === best).map(seat => seat.name);

  return (
    <div className="overlay">
      <div className="slip">
        <p className="slip-eyebrow">{final ? 'Match over' : 'Hand over'}</p>
        <h2 className="slip-title">
          {winner === null ? 'Draw — dealer repeats' : `${winner.name} wins`}
        </h2>
        {winner !== null && (
          <p className="slip-sub">
            {result.loser === null
              ? 'Self-drawn'
              : `Discarded by ${view.seats[result.loser]?.name ?? `seat ${result.loser}`}`}
          </p>
        )}

        {concealed.length > 0 && (
          <div className="slip-hand">
            <div className="tile-row">
              {concealed.map((tile, i) => (
                <span key={i} className={i === winIndex ? 'tile-win' : undefined}>
                  <TileFace t={tile} size="sm" />
                </span>
              ))}
            </div>
            {melds.length > 0 && (
              <div className="slip-melds">
                {melds.map((meld, i) => (
                  <div className="slip-meld" key={i}>
                    <div className="tile-row">
                      {meld.tiles.map((tile, j) => <TileFace key={j} t={tile} size="sm" />)}
                    </div>
                    <span className="slip-meld-label">{MELD_LABELS[meld.kind] ?? meld.kind}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {items.length > 0 && (
          <ul className="faan-list">
            {items.map((item, i) => (
              <li key={i}>
                <span className="faan-name">{item.name}</span>
                <span className="faan-value">{item.faan}</span>
              </li>
            ))}
            <li className="faan-total">
              <span className="faan-name">Total</span>
              <span className="faan-value">{result.faan} faan</span>
            </li>
          </ul>
        )}

        <table className="score-table">
          <thead>
            <tr><th>Seat</th><th>This hand</th><th>Score</th></tr>
          </thead>
          <tbody>
            {view.seats.map((seat, i) => (
              <tr key={i} className={i === result.winner ? 'is-winner' : undefined}>
                <td>{seat.name}{i === view.you ? ' (you)' : ''}</td>
                <td className={`num ${(result.payments[i] ?? 0) < 0 ? 'is-loss' : 'is-gain'}`}>
                  {signed(result.payments[i] ?? 0)}
                </td>
                <td className="num">{seat.score}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {final && (
          <p className="slip-champion">
            {champions.length > 1 ? 'Tied at the top: ' : 'Champion: '}
            <strong>{champions.join(' & ')}</strong> <span className="num">{best} points</span>
          </p>
        )}

        <div className="slip-actions">
          {view.host
            ? (
              <button type="button" onClick={() => conn.send(final ? { t: 'rematch' } : { t: 'nextHand' })}>
                {final ? 'Rematch' : 'Next hand'}
              </button>
              )
            : (
              <p className="slip-wait">
                Waiting for the host to {final ? 'start a rematch' : 'deal the next hand'}&hellip;
              </p>
              )}
        </div>
      </div>
    </div>
  );
}
