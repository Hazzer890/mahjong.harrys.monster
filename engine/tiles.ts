export type Tile = string;
export type Wind = 'E' | 'S' | 'W' | 'N';
export const WINDS: Wind[] = ['E', 'S', 'W', 'N'];

const suits = ['b', 'c', 'd'];
export const TILE_ORDER: Tile[] = [
  ...suits.flatMap(s => Array.from({ length: 9 }, (_, i) => s + (i + 1))),
  'wE', 'wS', 'wW', 'wN', 'dR', 'dG', 'dW',
  ...Array.from({ length: 8 }, (_, i) => 'f' + (i + 1)),
];

export const isFlower = (t: Tile) => t[0] === 'f';
export const isHonor = (t: Tile) => t[0] === 'w' || (t[0] === 'd' && isNaN(Number(t[1])));
export const suit = (t: Tile) => t[0];
export const rank = (t: Tile) => Number(t[1]);

export function buildWall(rng: () => number): Tile[] {
  const wall: Tile[] = [];
  for (const t of TILE_ORDER) {
    for (let i = 0; i < (isFlower(t) ? 1 : 4); i++) wall.push(t);
  }
  for (let i = wall.length - 1; i > 0; i--) { // Fisher-Yates
    const j = Math.floor(rng() * (i + 1));
    [wall[i], wall[j]] = [wall[j], wall[i]];
  }
  return wall;
}

export const sortTiles = (ts: Tile[]) =>
  [...ts].sort((a, b) => TILE_ORDER.indexOf(a) - TILE_ORDER.indexOf(b));
