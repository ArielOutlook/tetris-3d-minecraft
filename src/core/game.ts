import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  LOCK_DELAY_MS,
  MAX_LOCK_RESETS,
  PREVIEW_COUNT,
  SOFT_DROP_FACTOR,
  VISIBLE_ROWS,
} from '../config';
import { Bag } from './bag';
import {
  absoluteCells,
  clearRows,
  collides,
  createBoard,
  dropDistance,
  fullRows,
  placePiece,
  translated,
} from './board';
import { kicksFor } from './kicks';
import { boxSize, rotateIndex } from './pieces';
import { mulberry32, randomSeed, type Rng } from './rng';
import {
  gravityInterval,
  HARD_DROP_POINTS,
  levelForLines,
  lineClearScore,
  SOFT_DROP_POINTS,
} from './scoring';
import type { Action, ActivePiece, Board, GameEvent, GameStatus, PieceKind, StepInput, Vec3 } from './types';

export interface GameOptions {
  seed?: number;
  width?: number;
  visibleRows?: number;
  hiddenRows?: number;
  startLevel?: number;
}

export interface GameState {
  status: GameStatus;
  board: Board;
  active: ActivePiece | null;
  hold: PieceKind | null;
  holdUsed: boolean;
  queue: PieceKind[];
  score: number;
  level: number;
  lines: number;
  gravityAcc: number;
  lockTimer: number | null;
  lockResets: number;
  lowestY: number;
}

const NO_INPUT: StepInput = { actions: [], softDrop: false };

/**
 * Pure game simulation. `step(dt, input)` is the only mutation entry point during play;
 * it never reads real time, so results are deterministic for a given seed and input.
 */
export class Game {
  readonly width: number;
  readonly height: number;
  readonly visibleRows: number;
  private readonly startLevel: number;
  private rng: Rng;
  private bag: Bag;
  private _seed: number;
  private hasStarted = false;
  state: GameState;

  constructor(options: GameOptions = {}) {
    this.width = options.width ?? BOARD_WIDTH;
    this.visibleRows = options.visibleRows ?? VISIBLE_ROWS;
    this.height = this.visibleRows + (options.hiddenRows ?? BOARD_HEIGHT - VISIBLE_ROWS);
    this.startLevel = options.startLevel ?? 1;
    this._seed = options.seed ?? randomSeed();
    this.rng = mulberry32(this._seed);
    this.bag = new Bag(this.rng);
    this.state = this.freshState('menu');
  }

  get seed(): number {
    return this._seed;
  }

  /** Starts a new game. Without a seed, the first start uses the constructor seed; later ones a new random seed. */
  start(seed?: number): GameEvent[] {
    if (seed !== undefined) this._seed = seed;
    else if (this.hasStarted) this._seed = randomSeed();
    this.hasStarted = true;
    this.rng = mulberry32(this._seed);
    this.bag = new Bag(this.rng);
    this.state = this.freshState('playing');
    this.fillQueue();
    const events: GameEvent[] = [{ type: 'started' }];
    this.spawn(this.takeNext(), events);
    return events;
  }

  pause(): GameEvent[] {
    if (this.state.status !== 'playing') return [];
    this.state.status = 'paused';
    return [{ type: 'paused' }];
  }

  resume(): GameEvent[] {
    if (this.state.status !== 'paused') return [];
    this.state.status = 'playing';
    return [{ type: 'resumed' }];
  }

  togglePause(): GameEvent[] {
    return this.state.status === 'paused' ? this.resume() : this.pause();
  }

  /** Back to the title screen (keeps the board visible underneath). */
  toMenu(): void {
    this.state.status = 'menu';
  }

  /** Next pieces shown to the player. */
  preview(count = PREVIEW_COUNT): PieceKind[] {
    return this.state.queue.slice(0, count);
  }

  /** Landing position of the active piece, or null. */
  ghost(): ActivePiece | null {
    const { active, board } = this.state;
    if (!active) return null;
    return translated(active, 0, -dropDistance(board, active));
  }

  gravityMs(softDrop = false): number {
    const base = gravityInterval(this.state.level);
    return softDrop ? base / SOFT_DROP_FACTOR : base;
  }

  step(dtMs: number, input: StepInput = NO_INPUT): GameEvent[] {
    const events: GameEvent[] = [];
    for (const action of input.actions) {
      if (action === 'pause') {
        events.push(...this.togglePause());
        continue;
      }
      if (this.state.status !== 'playing') continue;
      this.apply(action, events);
    }
    if (this.state.status !== 'playing' || !this.state.active) return events;

    this.applyGravity(dtMs, input.softDrop);
    if (this.state.status === 'playing' && this.state.active) this.updateLock(dtMs, events);
    return events;
  }

  // ---------------------------------------------------------------------------

  private freshState(status: GameStatus): GameState {
    return {
      status,
      board: createBoard(this.width, this.height),
      active: null,
      hold: null,
      holdUsed: false,
      queue: [],
      score: 0,
      level: this.startLevel,
      lines: 0,
      gravityAcc: 0,
      lockTimer: null,
      lockResets: 0,
      lowestY: Number.POSITIVE_INFINITY,
    };
  }

  private fillQueue(): void {
    while (this.state.queue.length < 7) this.state.queue.push(this.bag.next());
  }

  private takeNext(): PieceKind {
    this.fillQueue();
    const kind = this.state.queue.shift() as PieceKind;
    this.fillQueue();
    return kind;
  }

  spawnPosition(kind: PieceKind): Vec3 {
    const n = boxSize(kind);
    return { x: Math.floor((this.width - n) / 2), y: this.height - n, z: 0 };
  }

  private spawn(kind: PieceKind, events: GameEvent[]): void {
    const piece: ActivePiece = { kind, rot: 0, pos: this.spawnPosition(kind) };
    const s = this.state;
    s.gravityAcc = 0;
    s.lockTimer = null;
    s.lockResets = 0;
    s.lowestY = piece.pos.y;
    if (collides(s.board, piece)) {
      s.active = null;
      this.gameOver(events);
      return;
    }
    s.active = piece;
    events.push({ type: 'spawned', kind });
  }

  private gameOver(events: GameEvent[]): void {
    const s = this.state;
    s.status = 'gameover';
    events.push({ type: 'gameOver', score: s.score, level: s.level, lines: s.lines });
  }

  private grounded(piece: ActivePiece): boolean {
    return collides(this.state.board, translated(piece, 0, -1));
  }

  /** Tries to replace the active piece; handles lock-delay resets. */
  private commit(next: ActivePiece): void {
    const s = this.state;
    s.active = next;
    if (next.pos.y < s.lowestY) {
      s.lowestY = next.pos.y;
      s.lockResets = 0;
      s.lockTimer = null;
    } else if (s.lockTimer !== null && s.lockResets < MAX_LOCK_RESETS) {
      s.lockTimer = 0;
      s.lockResets++;
    }
  }

  private tryShift(dx: number, events: GameEvent[]): boolean {
    const active = this.state.active;
    if (!active) return false;
    const next = translated(active, dx, 0);
    if (collides(this.state.board, next)) return false;
    this.commit(next);
    events.push({ type: 'moved' });
    return true;
  }

  private tryRotate(dir: 1 | -1, events: GameEvent[]): boolean {
    const active = this.state.active;
    if (!active) return false;
    const to = rotateIndex(active.rot, dir);
    const kicks = kicksFor(active.kind, active.rot, to);
    for (let i = 0; i < kicks.length; i++) {
      const k = kicks[i] as { x: number; y: number };
      const next = translated({ ...active, rot: to }, k.x, k.y);
      if (!collides(this.state.board, next)) {
        this.commit(next);
        events.push({ type: 'rotated', kicked: i > 0 });
        return true;
      }
    }
    return false;
  }

  private apply(action: Action, events: GameEvent[]): void {
    const s = this.state;
    if (!s.active) return;
    switch (action) {
      case 'left':
        this.tryShift(-1, events);
        break;
      case 'right':
        this.tryShift(1, events);
        break;
      case 'rotCW':
        this.tryRotate(1, events);
        break;
      case 'rotCCW':
        this.tryRotate(-1, events);
        break;
      case 'softDrop':
        // One-shot soft drop step (held soft drop is handled through StepInput.softDrop).
        if (!this.grounded(s.active)) {
          this.commit(translated(s.active, 0, -1));
          s.score += SOFT_DROP_POINTS;
          s.gravityAcc = 0;
          events.push({ type: 'moved' });
        }
        break;
      case 'hardDrop': {
        const distance = dropDistance(s.board, s.active);
        s.active = translated(s.active, 0, -distance);
        s.score += distance * HARD_DROP_POINTS;
        events.push({ type: 'hardDropped', distance });
        this.lock(events);
        break;
      }
      case 'hold':
        this.hold(events);
        break;
    }
  }

  private hold(events: GameEvent[]): void {
    const s = this.state;
    if (!s.active || s.holdUsed) return;
    const current = s.active.kind;
    const swapIn = s.hold ?? this.takeNext();
    s.hold = current;
    s.holdUsed = true;
    events.push({ type: 'held', kind: current });
    this.spawn(swapIn, events);
  }

  private applyGravity(dtMs: number, softDrop: boolean): void {
    const s = this.state;
    const interval = this.gravityMs(softDrop);
    // Clamp to the current interval so time banked at normal gravity is not
    // spent at soft-drop speed when the key goes down mid-cycle (≤ 1 row jump).
    s.gravityAcc = Math.min(s.gravityAcc, interval) + dtMs;
    while (s.active && s.gravityAcc >= interval) {
      if (this.grounded(s.active)) {
        s.gravityAcc = 0;
        break;
      }
      s.gravityAcc -= interval;
      this.commit(translated(s.active, 0, -1));
      if (softDrop) s.score += SOFT_DROP_POINTS;
    }
  }

  private updateLock(dtMs: number, events: GameEvent[]): void {
    const s = this.state;
    const active = s.active as ActivePiece;
    if (!this.grounded(active)) {
      s.lockTimer = null;
      return;
    }
    s.lockTimer = (s.lockTimer ?? 0) + dtMs;
    if (s.lockTimer >= LOCK_DELAY_MS) this.lock(events);
  }

  private lock(events: GameEvent[]): void {
    const s = this.state;
    const active = s.active;
    if (!active) return;
    const cells = placePiece(s.board, active);
    s.active = null;
    s.holdUsed = false;
    events.push({ type: 'locked', cells, kind: active.kind });

    const rows = fullRows(s.board);
    if (rows.length > 0) {
      const kinds = clearRows(s.board, rows);
      const count = rows.length as 1 | 2 | 3 | 4;
      s.score += lineClearScore(count, s.level);
      s.lines += count;
      events.push({ type: 'linesCleared', rows, count, kinds });
      const newLevel = levelForLines(s.lines, this.startLevel);
      if (newLevel > s.level) {
        s.level = newLevel;
        events.push({ type: 'levelUp', level: newLevel });
      }
    } else if (cells.every((c) => c.y >= this.visibleRows)) {
      // Lock out: the piece settled entirely above the visible well.
      this.gameOver(events);
      return;
    }
    this.spawn(this.takeNext(), events);
  }
}

/** Convenience used by renderers: absolute cells of any piece. */
export { absoluteCells };
