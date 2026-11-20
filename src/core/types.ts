export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const PIECE_KINDS = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const;
export type PieceKind = (typeof PIECE_KINDS)[number];

export type Rotation = 0 | 1 | 2 | 3;

export type Cell = PieceKind | null;

/** Board is indexed [row][col]; row 0 is the bottom. */
export type Board = Cell[][];

export interface ActivePiece {
  kind: PieceKind;
  rot: Rotation;
  /** Bottom-left corner of the piece's bounding box in board coordinates. z = 0 in classic mode. */
  pos: Vec3;
}

export type GameStatus = 'menu' | 'playing' | 'paused' | 'gameover';

export type Action = 'left' | 'right' | 'softDrop' | 'hardDrop' | 'rotCW' | 'rotCCW' | 'hold' | 'pause';

export interface StepInput {
  /** Discrete actions to apply this step, in order. */
  actions: readonly Action[];
  /** True while the soft-drop key is held. */
  softDrop: boolean;
}

export type GameEvent =
  | { type: 'moved' }
  | { type: 'rotated'; kicked: boolean }
  | { type: 'held'; kind: PieceKind }
  | { type: 'hardDropped'; distance: number }
  | { type: 'locked'; cells: Vec3[]; kind: PieceKind }
  | { type: 'linesCleared'; rows: number[]; count: 1 | 2 | 3 | 4; kinds: PieceKind[] }
  | { type: 'levelUp'; level: number }
  | { type: 'spawned'; kind: PieceKind }
  | { type: 'paused' }
  | { type: 'resumed' }
  | { type: 'started' }
  | { type: 'gameOver'; score: number; level: number; lines: number };
