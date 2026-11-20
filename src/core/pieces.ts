import type { PieceKind, Rotation } from './types';

/** Cell offset inside a piece bounding box, y-up (0 = bottom row of the box). */
export interface Offset {
  x: number;
  y: number;
}

/** Spawn-state shapes, drawn top row first (y-down), inside an n×n box. */
const SHAPES: Record<PieceKind, readonly string[]> = {
  I: ['....', '####', '....', '....'],
  O: ['##', '##'],
  T: ['.#.', '###', '...'],
  S: ['.##', '##.', '...'],
  Z: ['##.', '.##', '...'],
  J: ['#..', '###', '...'],
  L: ['..#', '###', '...'],
};

export function boxSize(kind: PieceKind): number {
  return SHAPES[kind].length;
}

function parse(rows: readonly string[]): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) if (row[c] === '#') cells.push([c, r]);
  });
  return cells;
}

/** Rotate y-down box coordinates 90° clockwise. */
function rotateCW(cells: Array<[number, number]>, n: number): Array<[number, number]> {
  return cells.map(([c, r]) => [n - 1 - r, c]);
}

function buildRotations(kind: PieceKind): Offset[][] {
  const n = boxSize(kind);
  let cells = parse(SHAPES[kind]);
  const states: Offset[][] = [];
  for (let i = 0; i < 4; i++) {
    states.push(cells.map(([c, r]) => ({ x: c, y: n - 1 - r })).sort((a, b) => a.y - b.y || a.x - b.x));
    cells = rotateCW(cells, n);
  }
  return states;
}

const ROTATIONS: Record<PieceKind, Offset[][]> = {
  I: buildRotations('I'),
  O: buildRotations('O'),
  T: buildRotations('T'),
  S: buildRotations('S'),
  Z: buildRotations('Z'),
  J: buildRotations('J'),
  L: buildRotations('L'),
};

export function pieceCells(kind: PieceKind, rot: Rotation): readonly Offset[] {
  return ROTATIONS[kind][rot] as Offset[];
}

export function rotateIndex(rot: Rotation, dir: 1 | -1): Rotation {
  return ((((rot + dir) % 4) + 4) % 4) as Rotation;
}
