import { Tile, suit, rank, isHonor, sortTiles, TILE_ORDER } from './tiles';

export interface Meld { kind: 'chow'|'pung'|'gong'|'concealedGong'; tiles: Tile[]; from: number|null }
export interface DecompSet { kind: 'chow'|'pung'; tiles: Tile[] }
export interface Decomp { sets: DecompSet[]; pair: Tile }

function next2(t: Tile): [Tile, Tile] | null {
  if (isHonor(t) || rank(t) > 7) return null;
  return [suit(t) + (rank(t) + 1), suit(t) + (rank(t) + 2)];
}

export function decompose(concealed: Tile[], meldCount: number): Decomp[] {
  const setsNeeded = 4 - meldCount;
  if (concealed.length !== setsNeeded * 3 + 2) return [];
  const results: Decomp[] = [];
  const counts = new Map<Tile, number>();
  for (const t of concealed) counts.set(t, (counts.get(t) ?? 0) + 1);

  const kinds = () => TILE_ORDER.filter(t => (counts.get(t) ?? 0) > 0);
  const take = (ts: Tile[], n = 1) => ts.forEach(t => counts.set(t, counts.get(t)! - n));
  const put = (ts: Tile[], n = 1) => ts.forEach(t => counts.set(t, counts.get(t)! + n));

  function solve(sets: DecompSet[], pair: Tile | null) {
    const remaining = kinds();
    if (remaining.length === 0) {
      if (sets.length === setsNeeded && pair) results.push({ sets: [...sets], pair });
      return;
    }
    const t = remaining[0]; // always resolve lowest tile first
    if (!pair && counts.get(t)! >= 2) {
      take([t], 2); solve(sets, t); put([t], 2);
    }
    if (counts.get(t)! >= 3) {
      take([t], 3); solve([...sets, { kind: 'pung', tiles: [t, t, t] }], pair); put([t], 3);
    }
    const n2 = next2(t);
    if (n2 && (counts.get(n2[0]) ?? 0) > 0 && (counts.get(n2[1]) ?? 0) > 0) {
      const chow = [t, ...n2];
      take(chow); solve([...sets, { kind: 'chow', tiles: chow }], pair); put(chow);
    }
  }
  solve([], null);
  // dedupe identical decompositions (same sets can be found via different orders)
  const seen = new Set<string>();
  return results.filter(d => {
    const key = d.pair + '|' + d.sets.map(s => s.tiles.join('')).sort().join(',');
    return seen.has(key) ? false : (seen.add(key), true);
  });
}

export const isWinning = (concealed: Tile[], meldCount: number) =>
  decompose(concealed, meldCount).length > 0;

const count = (hand: Tile[], t: Tile) => hand.filter(x => x === t).length;
export const canPung = (hand: Tile[], t: Tile) => count(hand, t) >= 2;
export const canGongDiscard = (hand: Tile[], t: Tile) => count(hand, t) >= 3;

export function chowOptions(hand: Tile[], t: Tile): Tile[][] {
  if (isHonor(t)) return [];
  const s = suit(t), r = rank(t);
  const has = (n: number) => n >= 1 && n <= 9 && hand.includes(s + n);
  const opts: Tile[][] = [];
  if (has(r - 2) && has(r - 1)) opts.push([s + (r - 2), s + (r - 1)]);
  if (has(r - 1) && has(r + 1)) opts.push([s + (r - 1), s + (r + 1)]);
  if (has(r + 1) && has(r + 2)) opts.push([s + (r + 1), s + (r + 2)]);
  return opts;
}

export const concealedGongOptions = (hand: Tile[]) =>
  [...new Set(hand)].filter(t => count(hand, t) === 4);
export const addedGongOptions = (hand: Tile[], melds: Meld[]) =>
  melds.filter(m => m.kind === 'pung' && hand.includes(m.tiles[0])).map(m => m.tiles[0]);
