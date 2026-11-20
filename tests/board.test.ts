import { describe, expect, it } from 'vitest';
import {
  absoluteCells,
  boardWidth,
  cellAt,
  clearRows,
  collides,
  createBoard,
  dropDistance,
  fullRows,
  placePiece,
} from '../src/core/board';
import type { ActivePiece } from '../src/core/types';
import { fillRow } from './helpers';

const piece = (x: number, y: number, kind: ActivePiece['kind'] = 'O'): ActivePiece => ({
  kind,
  rot: 0,
  pos: { x, y, z: 0 },
});

describe('board (REQ-G1, REQ-S2)', () => {
  it('creates an empty grid of the requested size', () => {
    const b = createBoard(10, 22);
    expect(b).toHaveLength(22);
    expect(boardWidth(b)).toBe(10);
    expect(b.flat().every((c) => c === null)).toBe(true);
    expect(boardWidth([])).toBe(0);
    expect(cellAt(b, -1, 0)).toBeNull();
  });

  it('detects walls, floor, ceiling and blocks', () => {
    const b = createBoard(10, 22);
    expect(collides(b, piece(0, 0))).toBe(false);
    expect(collides(b, piece(-1, 0))).toBe(true);
    expect(collides(b, piece(9, 0))).toBe(true);
    expect(collides(b, piece(0, -1))).toBe(true);
    expect(collides(b, piece(0, 21))).toBe(true);
    b[1]![1] = 'T';
    expect(collides(b, piece(0, 0))).toBe(true);
  });

  it('dropDistance and placePiece', () => {
    const b = createBoard(10, 22);
    expect(dropDistance(b, piece(4, 10))).toBe(10);
    const cells = placePiece(b, piece(4, 0));
    expect(cells).toHaveLength(4);
    expect(absoluteCells(piece(4, 0))).toEqual(cells);
    expect(b[0]![4]).toBe('O');
    expect(dropDistance(b, piece(4, 10))).toBe(8);
  });

  it.each([1, 2, 3, 4])('clears %i full rows and shifts the rest down', (n) => {
    const b = createBoard(10, 22);
    for (let y = 0; y < n; y++) fillRow(b, y);
    b[n]![3] = 'T';
    expect(fullRows(b)).toEqual(Array.from({ length: n }, (_, i) => i));
    const kinds = clearRows(b, fullRows(b));
    expect(kinds).toHaveLength(10 * n);
    expect(b).toHaveLength(22);
    expect(b[0]![3]).toBe('T');
    expect(fullRows(b)).toEqual([]);
  });

  it('clears non-contiguous rows', () => {
    const b = createBoard(4, 6);
    fillRow(b, 0);
    fillRow(b, 1, [2]);
    fillRow(b, 2);
    clearRows(b, fullRows(b));
    expect(b[0]).toEqual(['O', 'O', null, 'O']);
    expect(b[1]!.every((c) => c === null)).toBe(true);
  });
});
