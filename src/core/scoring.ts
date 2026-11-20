import { GRAVITY_TABLE_MS, LINES_PER_LEVEL } from '../config';

const LINE_SCORES = [0, 100, 300, 500, 800] as const;

export function lineClearScore(count: number, level: number): number {
  const base = LINE_SCORES[Math.max(0, Math.min(4, count))] ?? 0;
  return base * level;
}

export const SOFT_DROP_POINTS = 1;
export const HARD_DROP_POINTS = 2;

export function levelForLines(lines: number, startLevel = 1): number {
  return startLevel + Math.floor(Math.max(0, lines) / LINES_PER_LEVEL);
}

/** Milliseconds per row for a level (1-based). */
export function gravityInterval(level: number): number {
  const idx = Math.max(0, Math.min(GRAVITY_TABLE_MS.length - 1, level - 1));
  return GRAVITY_TABLE_MS[idx] as number;
}
