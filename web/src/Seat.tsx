import type { SeatView } from '../../server/protocol';
import { WINDS } from '../../engine/tiles';
import { TileBackRow, TileFace } from './tiles';

export default function Seat({
  seat, seatIndex, dealer, n, isTurn, position,
}: {
  seat: SeatView; seatIndex: number; dealer: number; n: number; isTurn: boolean;
  position: 'top' | 'left' | 'right';
}) {
  const wind = WINDS[(seatIndex - dealer + n) % n];

  return (
    <div className={`seat seat--${position}${isTurn ? ' seat--turn' : ''}`}>
      <div className="seat-header">
        <span className={`dot ${seat.connected ? 'on' : 'off'}`} />
        <span className="seat-name">{seat.name}</span>
        <span className="seat-wind">{wind}</span>
        <span className="seat-score">{seat.score}</span>
      </div>
      <TileBackRow count={seat.handCount} size="sm" />
      {seat.melds.length > 0 && (
        <div className="melds">
          {seat.melds.map((meld, i) => (
            <div className="meld" key={i}>
              {meld.kind === 'concealedGong'
                ? <TileBackRow count={4} size="sm" />
                : meld.tiles.map((t, j) => <TileFace key={j} t={t} size="sm" />)}
            </div>
          ))}
        </div>
      )}
      {seat.flowers.length > 0 && (
        <div className="flowers">
          {seat.flowers.map((t, i) => <TileFace key={i} t={t} size="sm" />)}
        </div>
      )}
    </div>
  );
}
