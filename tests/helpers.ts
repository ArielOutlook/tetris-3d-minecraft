import { Game } from '../src/core/game';
import type { Action, ActivePiece, Board, PieceKind } from '../src/core/types';
import { STEP_MS } from '../src/config';

export function act(game: Game, ...actions: Action[]) {
  return game.step(0, { actions, softDrop: false });
}

/** Advance simulated time with fixed steps. */
export function run(game: Game, ms: number, softDrop = false) {
  const events = [];
  let t = 0;
  while (t + 1e-9 < ms) {
    events.push(...game.step(STEP_MS, { actions: [], softDrop }));
    t += STEP_MS;
  }
  return events;
}

/** Fill a board row except for the given columns. */
export function fillRow(board: Board, y: number, holes: number[] = [], kind: PieceKind = 'O') {
  const row = board[y]!;
  for (let x = 0; x < row.length; x++) row[x] = holes.includes(x) ? null : kind;
}

export function setActive(game: Game, piece: ActivePiece) {
  game.state.active = piece;
  game.state.lowestY = piece.pos.y;
  game.state.lockTimer = null;
  game.state.lockResets = 0;
}

export function started(seed = 42): Game {
  const g = new Game({ seed });
  g.start();
  return g;
}
