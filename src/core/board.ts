import { pieceCells } from './pieces';
import type { ActivePiece, Board, Cell, PieceKind, Vec3 } from './types';

export function createBoard(width: number, height: number): Board {
  return Array.from({ length: height }, () => Array<Cell>(width).fill(null));
}

export function boardWidth(board: Board): number {
  return board[0]?.length ?? 0;
}

export function cellAt(board: Board, x: number, y: number): Cell {
  return board[y]?.[x] ?? null;
}

/** Absolute board cells occupied by a piece. */
export function absoluteCells(piece: ActivePiece): Vec3[] {
  return pieceCells(piece.kind, piece.rot).map((c) => ({
    x: piece.pos.x + c.x,
    y: piece.pos.y + c.y,
    z: piece.pos.z,
  }));
}

/** True when the piece overlaps a wall, the floor, the ceiling or a fixed block. */
export function collides(board: Board, piece: ActivePiece): boolean {
  const width = boardWidth(board);
  const height = board.length;
  for (const c of absoluteCells(piece)) {
    if (c.x < 0 || c.x >= width || c.y < 0 || c.y >= height) return true;
    if (cellAt(board, c.x, c.y) !== null) return true;
  }
  return false;
}

export function translated(piece: ActivePiece, dx: number, dy: number): ActivePiece {
  return { ...piece, pos: { x: piece.pos.x + dx, y: piece.pos.y + dy, z: piece.pos.z } };
}

/** How many rows the piece can fall before resting. */
export function dropDistance(board: Board, piece: ActivePiece): number {
  let d = 0;
  while (!collides(board, translated(piece, 0, -(d + 1)))) d++;
  return d;
}

export function placePiece(board: Board, piece: ActivePiece): Vec3[] {
  const cells = absoluteCells(piece);
  for (const c of cells) {
    const row = board[c.y];
    if (row && c.x >= 0 && c.x < row.length) row[c.x] = piece.kind;
  }
  return cells;
}

export function fullRows(board: Board): number[] {
  const rows: number[] = [];
  board.forEach((row, y) => {
    if (row.every((c) => c !== null)) rows.push(y);
  });
  return rows;
}

/** Removes the given rows (ascending) and shifts everything above down. Returns cleared kinds. */
export function clearRows(board: Board, rows: readonly number[]): PieceKind[] {
  const width = boardWidth(board);
  const kinds: PieceKind[] = [];
  const toClear = new Set(rows);
  const kept: Cell[][] = [];
  board.forEach((row, y) => {
    if (toClear.has(y)) kinds.push(...(row.filter((c) => c !== null) as PieceKind[]));
    else kept.push(row);
  });
  while (kept.length < board.length) kept.push(Array<Cell>(width).fill(null));
  for (let y = 0; y < board.length; y++) board[y] = kept[y] as Cell[];
  return kinds;
}
