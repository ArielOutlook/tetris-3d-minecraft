import { describe, expect, it } from 'vitest';
import { kicksFor } from '../src/core/kicks';
import { boxSize, pieceCells, rotateIndex } from '../src/core/pieces';
import { PIECE_KINDS, type Rotation } from '../src/core/types';

describe('pieces (REQ-G2)', () => {
  it('every piece has 4 cells in every rotation, inside its box', () => {
    for (const k of PIECE_KINDS) {
      const n = boxSize(k);
      for (const r of [0, 1, 2, 3] as Rotation[]) {
        const cells = pieceCells(k, r);
        expect(cells).toHaveLength(4);
        for (const c of cells) {
          expect(c.x).toBeGreaterThanOrEqual(0);
          expect(c.x).toBeLessThan(n);
          expect(c.y).toBeGreaterThanOrEqual(0);
          expect(c.y).toBeLessThan(n);
        }
      }
    }
  });

  it('four clockwise rotations return to the spawn state', () => {
    for (const k of PIECE_KINDS) {
      let r: Rotation = 0;
      for (let i = 0; i < 4; i++) r = rotateIndex(r, 1);
      expect(r).toBe(0);
      expect(pieceCells(k, r)).toEqual(pieceCells(k, 0));
    }
  });

  it('rotateIndex wraps both ways', () => {
    expect(rotateIndex(0, -1)).toBe(3);
    expect(rotateIndex(3, 1)).toBe(0);
  });

  it('T spawn state points up (y-up coordinates)', () => {
    // .#.
    // ###
    expect(pieceCells('T', 0)).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
    ]);
  });

  it('O is identical in every rotation', () => {
    for (const r of [1, 2, 3] as Rotation[]) expect(pieceCells('O', r)).toEqual(pieceCells('O', 0));
  });
});

describe('kicks', () => {
  it('O never kicks', () => {
    expect(kicksFor('O', 0, 1)).toEqual([{ x: 0, y: 0 }]);
  });

  it('general and straight tables have 5 tests starting at (0,0)', () => {
    for (const k of ['T', 'I'] as const) {
      for (const [from, to] of [
        [0, 1],
        [1, 0],
        [1, 2],
        [2, 1],
        [2, 3],
        [3, 2],
        [3, 0],
        [0, 3],
      ] as Array<[Rotation, Rotation]>) {
        const kicks = kicksFor(k, from, to);
        expect(kicks).toHaveLength(5);
        expect(kicks[0]).toEqual({ x: 0, y: 0 });
      }
    }
  });

  it('straight piece uses its own table', () => {
    expect(kicksFor('I', 0, 1)[1]).toEqual({ x: -2, y: 0 });
    expect(kicksFor('T', 0, 1)[1]).toEqual({ x: -1, y: 0 });
  });

  it('invalid transitions fall back to no kick', () => {
    expect(kicksFor('T', 0, 2)).toEqual([{ x: 0, y: 0 }]);
  });
});
