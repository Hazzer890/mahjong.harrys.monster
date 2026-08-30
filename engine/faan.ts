import { Tile, Wind, isHonor, isFlower, suit } from './tiles';
import { Meld, decompose, DecompSet } from './hand';

export interface WinContext {
  seatWind: Wind; roundWind: Wind; flowers: Tile[]; seatWindIndex: number;
  selfDraw: boolean; lastTile: boolean; robbingGong: boolean; replacementDraw: boolean;
  heavenly: boolean; earthly: boolean;
}
export interface FaanItem { name: string; faan: number }
export interface Score { faan: number; items: FaanItem[] }

export function scoreHand(concealed: Tile[], melds: Meld[], ctx: WinContext): Score | null {
  const decomps = decompose(concealed, melds.length);
  if (decomps.length === 0) return null;
  let best: Score | null = null;
  for (const d of decomps) {
    const s = scoreDecomp(d.sets, d.pair, melds, ctx);
    if (!best || s.faan > best.faan) best = s;
  }
  return best;
}

function scoreDecomp(sets: DecompSet[], pair: Tile, melds: Meld[], ctx: WinContext): Score {
  const items: FaanItem[] = [];
  const add = (name: string, faan: number) => items.push({ name, faan });

  // normalize: meld gongs behave as pungs
  const allSets = [
    ...sets,
    ...melds.map(m => ({ kind: m.kind === 'chow' ? 'chow' as const : 'pung' as const, tiles: m.tiles.slice(0, 3) })),
  ];
  const setTiles = allSets.map(s => s.tiles[0]);
  const everyTile = [...allSets.flatMap(s => s.tiles), pair, pair];

  if (ctx.heavenly) return { faan: 13, items: [{ name: 'Heavenly hand', faan: 13 }] };
  if (ctx.earthly) return { faan: 13, items: [{ name: 'Earthly hand', faan: 13 }] };

  const dragonPungs = setTiles.filter(t => ['dR','dG','dW'].includes(t)).length;
  if (dragonPungs === 3) return { faan: 13, items: [{ name: 'Great dragons', faan: 13 }] };
  const windPungs = setTiles.filter(t => t[0] === 'w').length;
  if (windPungs === 4) return { faan: 13, items: [{ name: 'Great winds', faan: 13 }] };

  if (allSets.every(s => s.kind === 'chow')) add('All chows', 1);
  if (allSets.every(s => s.kind === 'pung')) add('All pungs', 3);

  const suitsUsed = new Set(everyTile.filter(t => !isHonor(t)).map(suit));
  const hasHonor = everyTile.some(isHonor);
  if (suitsUsed.size === 1) add(hasHonor ? 'Mixed one suit' : 'Pure one suit', hasHonor ? 3 : 7);
  if (suitsUsed.size === 0) add('All honors', 10);

  for (const t of setTiles) {
    if (['dR','dG','dW'].includes(t)) add('Dragon pung', 1);
    if (t === 'w' + ctx.seatWind) add('Seat wind', 1);
    if (t === 'w' + ctx.roundWind) add('Round wind', 1);
  }
  if (dragonPungs === 2 && ['dR','dG','dW'].includes(pair)) add('Small dragons', 3);
  if (windPungs === 3 && pair[0] === 'w') add('Small winds', 6);

  for (const f of ctx.flowers) add('Flower', 1);
  const nums = ctx.flowers.map(f => Number(f[1]));
  if ([1,2,3,4].every(n => nums.includes(n))) add('Flower quartet', 2);
  if ([5,6,7,8].every(n => nums.includes(n))) add('Season quartet', 2);
  if (ctx.flowers.length === 0) add('No flowers', 1);

  if (ctx.selfDraw) add('Self-draw', 1);
  if (ctx.lastTile) add('Last tile', 1);
  if (ctx.robbingGong) add('Robbing the gong', 1);
  if (ctx.replacementDraw) add('Win on replacement', 1);

  const faan = Math.min(13, items.reduce((a, i) => a + i.faan, 0));
  return { faan, items };
}
