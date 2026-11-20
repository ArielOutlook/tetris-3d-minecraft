import type { Offset } from './pieces';
import type { PieceKind, Rotation } from './types';

type KickTable = Record<string, readonly Offset[]>;

const o = (x: number, y: number): Offset => ({ x, y });

/** Wall kicks for J, L, S, T, Z (y-up). Key = `${from}>${to}`. */
const GENERAL: KickTable = {
  '0>1': [o(0, 0), o(-1, 0), o(-1, 1), o(0, -2), o(-1, -2)],
  '1>0': [o(0, 0), o(1, 0), o(1, -1), o(0, 2), o(1, 2)],
  '1>2': [o(0, 0), o(1, 0), o(1, -1), o(0, 2), o(1, 2)],
  '2>1': [o(0, 0), o(-1, 0), o(-1, 1), o(0, -2), o(-1, -2)],
  '2>3': [o(0, 0), o(1, 0), o(1, 1), o(0, -2), o(1, -2)],
  '3>2': [o(0, 0), o(-1, 0), o(-1, -1), o(0, 2), o(-1, 2)],
  '3>0': [o(0, 0), o(-1, 0), o(-1, -1), o(0, 2), o(-1, 2)],
  '0>3': [o(0, 0), o(1, 0), o(1, 1), o(0, -2), o(1, -2)],
};

/** Wall kicks for the straight 4-cell piece. */
const STRAIGHT: KickTable = {
  '0>1': [o(0, 0), o(-2, 0), o(1, 0), o(-2, -1), o(1, 2)],
  '1>0': [o(0, 0), o(2, 0), o(-1, 0), o(2, 1), o(-1, -2)],
  '1>2': [o(0, 0), o(-1, 0), o(2, 0), o(-1, 2), o(2, -1)],
  '2>1': [o(0, 0), o(1, 0), o(-2, 0), o(1, -2), o(-2, 1)],
  '2>3': [o(0, 0), o(2, 0), o(-1, 0), o(2, 1), o(-1, -2)],
  '3>2': [o(0, 0), o(-2, 0), o(1, 0), o(-2, -1), o(1, 2)],
  '3>0': [o(0, 0), o(1, 0), o(-2, 0), o(1, -2), o(-2, 1)],
  '0>3': [o(0, 0), o(-1, 0), o(2, 0), o(-1, 2), o(2, -1)],
};

const NONE: readonly Offset[] = [o(0, 0)];

export function kicksFor(kind: PieceKind, from: Rotation, to: Rotation): readonly Offset[] {
  if (kind === 'O') return NONE;
  const table = kind === 'I' ? STRAIGHT : GENERAL;
  return table[`${from}>${to}`] ?? NONE;
}
