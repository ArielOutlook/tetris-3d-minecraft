/** Visible product name. Single source of truth for UI and metadata. */
export const GAME_TITLE = 'Bloquecaída 3D';

export const BOARD_WIDTH = 10;
export const VISIBLE_ROWS = 20;
export const HIDDEN_ROWS = 2;
export const BOARD_HEIGHT = VISIBLE_ROWS + HIDDEN_ROWS;

/** Fixed simulation step (ms). Gravity never depends on render FPS. */
export const STEP_MS = 1000 / 120;
/** Max frame delta fed to the accumulator (avoids spiral after a background tab). */
export const MAX_FRAME_MS = 250;

export const DAS_MS = 170;
export const ARR_MS = 50;
export const SOFT_DROP_FACTOR = 20;

export const LOCK_DELAY_MS = 500;
export const MAX_LOCK_RESETS = 15;

export const LINES_PER_LEVEL = 10;
export const PREVIEW_COUNT = 3;

/** Milliseconds per row, indexed by level - 1. Levels past the end use the last value. */
export const GRAVITY_TABLE_MS: readonly number[] = [1000, 793, 618, 473, 355, 262, 190, 135, 94, 64, 50];

export const STORAGE_KEYS = {
  highscores: 'bloquecaida3d:highscores',
  settings: 'bloquecaida3d:settings',
} as const;
