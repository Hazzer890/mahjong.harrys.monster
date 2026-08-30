import { isFlower, isHonor, suit as suitOf, type Tile } from '../../engine/tiles';

export type TileSize = 'sm' | 'md' | 'lg';

const WIDTH: Record<TileSize, number> = { sm: 30, md: 42, lg: 58 };
const RATIO = 1.4; // height = width * RATIO, viewBox is always 100x140

type Kind = 'b' | 'c' | 'd' | 'wind' | 'dragon' | 'flower';

export function kindOf(t: Tile): Kind {
  if (isFlower(t)) return 'flower';
  if (isHonor(t)) return t[0] === 'w' ? 'wind' : 'dragon';
  return suitOf(t) as 'b' | 'c' | 'd';
}

// Face inks, drawn from the table's palette rather than Material defaults, and all
// kept dark enough to stay legible on the ivory face.
const CINNABAR = '#b8362c';
const JADE = '#1c6b4a';
const INK = '#17130f';
const INK_BLUE = '#1d4f8c';
const BRASS = '#8a5a12';

const NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const WIND_CHARS: Record<string, string> = { E: '東', S: '南', W: '西', N: '北' };
const DRAGON_CHARS: Record<string, { char: string; color: string }> = {
  R: { char: '中', color: CINNABAR },
  G: { char: '發', color: JADE },
  W: { char: '', color: INK },
};
const FLOWER_CHARS = ['梅', '蘭', '菊', '竹', '春', '夏', '秋', '冬'];
const DOT_COLORS = [INK_BLUE, JADE, CINNABAR];

// Symmetric pip layouts (percent coords, 0-100) shared by dots and bamboo.
export function pips(n: number): [number, number][] {
  const layouts: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[32, 32], [68, 68]],
    3: [[26, 26], [50, 50], [74, 74]],
    4: [[32, 28], [68, 28], [32, 72], [68, 72]],
    5: [[32, 28], [68, 28], [50, 50], [32, 72], [68, 72]],
    6: [[32, 22], [32, 50], [32, 78], [68, 22], [68, 50], [68, 78]],
    7: [[50, 15], [26, 40], [50, 40], [74, 40], [26, 68], [50, 68], [74, 68]],
    8: [[24, 30], [42, 30], [58, 30], [76, 30], [24, 70], [42, 70], [58, 70], [76, 70]],
    9: [[26, 22], [50, 22], [74, 22], [26, 50], [50, 50], [74, 50], [26, 78], [50, 78], [74, 78]],
  };
  return layouts[n] ?? layouts[9];
}

const px = (v: number) => 10 + (v / 100) * 80; // 10..90
const py = (v: number) => 15 + (v / 100) * 110; // 15..125 (viewBox is 140 tall)

function FaceContent({ t }: { t: Tile }) {
  const kind = kindOf(t);
  const r = t[1];

  if (kind === 'c') {
    return (
      <>
        <text x="50" y="48" textAnchor="middle" fontSize="34" fill={CINNABAR} fontFamily="'Noto Serif SC', serif">{NUMERALS[Number(r) - 1]}</text>
        <text x="50" y="112" textAnchor="middle" fontSize="46" fill={INK} fontFamily="'Noto Serif SC', serif">萬</text>
      </>
    );
  }
  if (kind === 'd') {
    return (
      <>
        {pips(Number(r)).map(([x, y], i) => (
          <circle key={i} cx={px(x)} cy={py(y)} r={8} fill={DOT_COLORS[i % 3]} />
        ))}
      </>
    );
  }
  if (kind === 'b') {
    if (r === '1') return <rect x={44} y={20} width={12} height={100} rx={6} fill={JADE} />;
    return (
      <>
        {pips(Number(r)).map(([x, y], i) => (
          <rect key={i} x={px(x) - 5} y={py(y) - 14} width={10} height={28} rx={5} fill={JADE} />
        ))}
      </>
    );
  }
  if (kind === 'wind') {
    return <text x="50" y="85" textAnchor="middle" fontSize="52" fill={INK} fontFamily="'Noto Serif SC', serif">{WIND_CHARS[t.slice(1)]}</text>;
  }
  if (kind === 'dragon') {
    const d = DRAGON_CHARS[t.slice(1)];
    return d.char
      ? <text x="50" y="85" textAnchor="middle" fontSize="56" fill={d.color} fontFamily="'Noto Serif SC', serif">{d.char}</text>
      : <rect x={20} y={30} width={60} height={80} fill="none" stroke={INK_BLUE} strokeWidth={4} rx={6} />;
  }
  // flower
  return <text x="50" y="85" textAnchor="middle" fontSize="46" fill={BRASS} fontFamily="'Noto Serif SC', serif">{FLOWER_CHARS[Number(r) - 1]}</text>;
}

const SUIT_NAMES: Record<string, string> = { b: 'bamboo', c: 'characters', d: 'dots' };
const WIND_NAMES: Record<string, string> = { E: 'east', S: 'south', W: 'west', N: 'north' };
const DRAGON_NAMES: Record<string, string> = { R: 'red', G: 'green', W: 'white' };

// A clickable tile is a button, and a button needs a name a screen reader can read.
export function tileName(t: Tile): string {
  const kind = kindOf(t);
  if (kind === 'wind') return `${WIND_NAMES[t.slice(1)]} wind`;
  if (kind === 'dragon') return `${DRAGON_NAMES[t.slice(1)]} dragon`;
  if (kind === 'flower') return `flower ${t[1]}`;
  return `${t[1]} ${SUIT_NAMES[kind]}`;
}

export function TileFace({
  t, size = 'md', selected = false, onClick,
}: { t: Tile; size?: TileSize; selected?: boolean; onClick?: () => void }) {
  const w = WIDTH[size];
  return (
    <span
      className={`tile${selected ? ' tile--selected' : ''}${onClick ? ' tile--clickable' : ''}`}
      style={{ width: w, height: w * RATIO }}
      onClick={onClick}
      onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      role={onClick ? 'button' : undefined}
      aria-label={onClick ? tileName(t) : undefined}
      aria-pressed={onClick ? selected : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <svg viewBox="0 0 100 140" width="100%" height="100%">
        <rect x="2" y="2" width="96" height="136" rx="8" fill="#fbf8f0" stroke="#999" strokeWidth="2" />
        <FaceContent t={t} />
      </svg>
    </span>
  );
}

export function TileBack({ size = 'md' }: { size?: TileSize }) {
  const w = WIDTH[size];
  return (
    <span className="tile" style={{ width: w, height: w * RATIO }}>
      <svg viewBox="0 0 100 140" width="100%" height="100%">
        <rect x="2" y="2" width="96" height="136" rx="8" fill="#1f5c46" stroke="#123125" strokeWidth="2" />
        <rect x="14" y="14" width="72" height="112" rx="4" fill="none" stroke="#37876a" strokeWidth="2" />
      </svg>
    </span>
  );
}

export function TileRow({ tiles, size = 'md' }: { tiles: Tile[]; size?: TileSize }) {
  return (
    <div className="tile-row">
      {tiles.map((t, i) => <TileFace key={i} t={t} size={size} />)}
    </div>
  );
}

export function TileBackRow({ count, size = 'md' }: { count: number; size?: TileSize }) {
  return (
    <div className="tile-row">
      {Array.from({ length: count }, (_, i) => <TileBack key={i} size={size} />)}
    </div>
  );
}
