import { describe, expect, it } from 'vitest';
import { LOCK_DELAY_MS, MAX_LOCK_RESETS, STEP_MS } from '../src/config';
import { absoluteCells, collides } from '../src/core/board';
import { Game } from '../src/core/game';
import { FixedStepper } from '../src/core/stepper';
import type { GameEvent } from '../src/core/types';
import { act, fillRow, run, setActive, started } from './helpers';

const types = (events: GameEvent[]) => events.map((e) => e.type);

describe('Game lifecycle (REQ-E1, REQ-G4)', () => {
  it('starts in menu and ignores steps until started', () => {
    const g = new Game({ seed: 1 });
    expect(g.state.status).toBe('menu');
    expect(g.step(1000)).toEqual([]);
    expect(g.ghost()).toBeNull();
    const ev = g.start();
    expect(types(ev)).toEqual(['started', 'spawned']);
    expect(g.state.status).toBe('playing');
    expect(g.preview()).toHaveLength(3);
    expect(g.seed).toBe(1);
  });

  it('spawns centered inside the hidden rows', () => {
    const g = started();
    for (const kind of ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const) {
      const pos = g.spawnPosition(kind);
      setActive(g, { kind, rot: 0, pos });
      const cells = absoluteCells(g.state.active!);
      const xs = cells.map((c) => c.x);
      const center = (Math.min(...xs) + Math.max(...xs) + 1) / 2;
      expect(Math.abs(center - 5)).toBeLessThanOrEqual(0.5);
      expect(Math.max(...cells.map((c) => c.y))).toBeLessThanOrEqual(21);
      expect(cells.every((c) => c.y >= 20)).toBe(true);
    }
  });

  it('pause/resume through action and methods; actions ignored while paused', () => {
    const g = started();
    const x = g.state.active!.pos.x;
    expect(types(act(g, 'pause'))).toEqual(['paused']);
    expect(g.state.status).toBe('paused');
    act(g, 'left');
    expect(g.state.active!.pos.x).toBe(x);
    expect(run(g, 3000)).toEqual([]);
    expect(types(act(g, 'pause'))).toEqual(['resumed']);
    expect(g.pause()).toHaveLength(1);
    expect(g.pause()).toEqual([]);
    expect(g.togglePause()).toEqual([{ type: 'resumed' }]);
    expect(g.resume()).toEqual([]);
  });

  it('new start after the first uses a new seed unless provided', () => {
    const g = new Game({ seed: 5 });
    g.start();
    g.toMenu();
    expect(g.state.status).toBe('menu');
    g.start(77);
    expect(g.seed).toBe(77);
    const before = g.seed;
    g.start();
    expect(g.seed).not.toBe(before);
  });

  it('same seed → same piece sequence', () => {
    const a = new Game({ seed: 9 });
    const b = new Game({ seed: 9 });
    a.start();
    b.start();
    expect(a.state.active!.kind).toBe(b.state.active!.kind);
    expect(a.preview(6)).toEqual(b.preview(6));
  });

  it('game over when a new piece cannot spawn (block out)', () => {
    const g = started();
    for (const y of [20, 21]) for (let x = 3; x <= 6; x++) g.state.board[y]![x] = 'T';
    setActive(g, { kind: 'O', rot: 0, pos: { x: 0, y: 0, z: 0 } });
    const ev = act(g, 'hardDrop');
    expect(types(ev)).toEqual(['hardDropped', 'locked', 'gameOver']);
    expect(g.state.status).toBe('gameover');
    expect(g.state.active).toBeNull();
    // Steps after game over do nothing.
    expect(act(g, 'left')).toEqual([]);
    expect(run(g, 1000)).toEqual([]);
  });

  it('game over when a piece locks entirely above the visible well (lock out)', () => {
    const g = started();
    for (let y = 0; y < 20; y++) fillRow(g.state.board, y, [0]);
    setActive(g, { kind: 'O', rot: 0, pos: { x: 6, y: 20, z: 0 } });
    const ev = act(g, 'hardDrop');
    expect(types(ev)).toEqual(['hardDropped', 'locked', 'gameOver']);
  });

  it('repeated hard drops at the center eventually end the game', () => {
    const g = started();
    let over = false;
    for (let i = 0; i < 100 && !over; i++) over = types(act(g, 'hardDrop')).includes('gameOver');
    expect(over).toBe(true);
    const last = g.state;
    expect(last.status).toBe('gameover');
  });
});

describe('movement (REQ-M1)', () => {
  it('moves left/right until the wall, never through it', () => {
    const g = started();
    for (let i = 0; i < 20; i++) act(g, 'left');
    const xs = absoluteCells(g.state.active!).map((c) => c.x);
    expect(Math.min(...xs)).toBe(0);
    for (let i = 0; i < 20; i++) act(g, 'right');
    expect(Math.max(...absoluteCells(g.state.active!).map((c) => c.x))).toBe(9);
    expect(types(act(g, 'right'))).toEqual([]);
  });

  it('does not move through fixed blocks', () => {
    const g = started();
    setActive(g, { kind: 'O', rot: 0, pos: { x: 4, y: 0, z: 0 } });
    g.state.board[0]![3] = 'T';
    expect(types(act(g, 'left'))).toEqual([]);
    expect(types(act(g, 'right'))).toEqual(['moved']);
  });

  it('one-shot soft drop moves down and scores 1', () => {
    const g = started();
    const y = g.state.active!.pos.y;
    expect(types(act(g, 'softDrop'))).toEqual(['moved']);
    expect(g.state.active!.pos.y).toBe(y - 1);
    expect(g.state.score).toBe(1);
    setActive(g, { kind: 'O', rot: 0, pos: { x: 4, y: 0, z: 0 } });
    expect(act(g, 'softDrop')).toEqual([]);
  });

  it('held soft drop falls 20× faster and scores per cell', () => {
    const g = started();
    const y = g.state.active!.pos.y;
    run(g, 500, true); // 500 ms / (1000/20) = 10 rows
    expect(y - g.state.active!.pos.y).toBe(10);
    expect(g.state.score).toBe(10);
  });

  it('pressing soft drop mid gravity cycle never teleports the piece (regression)', () => {
    // Bank time at normal gravity at several phases of the 1 s cycle, then hold ↓.
    for (const banked of [100, 500, 950, 990]) {
      const g = started(1);
      const y0 = g.state.active!.pos.y;
      run(g, banked);
      expect(g.state.active!.pos.y).toBe(y0); // still under one normal interval
      const scoreBefore = g.state.score;
      g.step(STEP_MS, { actions: [], softDrop: true });
      const dropped = y0 - g.state.active!.pos.y;
      expect(dropped).toBeLessThanOrEqual(1);
      expect(g.state.score - scoreBefore).toBe(dropped);
      // Keeps falling at the soft-drop rate afterwards: 500 ms → 10 more rows.
      const y1 = g.state.active!.pos.y;
      run(g, 500, true);
      expect(y1 - g.state.active!.pos.y).toBe(10);
    }
  });

  it('releasing soft drop returns to normal gravity without an extra row', () => {
    const g = started(1);
    run(g, 200, true); // 4 rows at soft-drop speed
    const y = g.state.active!.pos.y;
    run(g, 900); // below one normal interval → no row
    expect(g.state.active!.pos.y).toBe(y);
    run(g, 150);
    expect(g.state.active!.pos.y).toBe(y - 1);
  });
});

describe('rotation and kicks (REQ-M2)', () => {
  it('rotates CW and CCW in open space without kicking', () => {
    const g = started();
    setActive(g, { kind: 'T', rot: 0, pos: { x: 4, y: 10, z: 0 } });
    expect(act(g, 'rotCW')).toEqual([{ type: 'rotated', kicked: false }]);
    expect(g.state.active!.rot).toBe(1);
    act(g, 'rotCCW');
    act(g, 'rotCCW');
    expect(g.state.active!.rot).toBe(3);
  });

  it('T against the left wall kicks inside the well, never outside', () => {
    const g = started();
    // rot 1 (pointing right) occupies box column 1..2; x=-1 puts the stem at column 0.
    setActive(g, { kind: 'T', rot: 1, pos: { x: -1, y: 10, z: 0 } });
    expect(collides(g.state.board, g.state.active!)).toBe(false);
    const ev = act(g, 'rotCCW'); // to rot 0, would need column -1
    expect(ev).toEqual([{ type: 'rotated', kicked: true }]);
    const cells = absoluteCells(g.state.active!);
    expect(Math.min(...cells.map((c) => c.x))).toBeGreaterThanOrEqual(0);
    expect(collides(g.state.board, g.state.active!)).toBe(false);
  });

  it('I piece kicks off the right wall', () => {
    const g = started();
    setActive(g, { kind: 'I', rot: 1, pos: { x: 7, y: 10, z: 0 } }); // vertical at column 9
    expect(Math.max(...absoluteCells(g.state.active!).map((c) => c.x))).toBe(9);
    const ev = act(g, 'rotCW');
    expect(ev[0]).toEqual({ type: 'rotated', kicked: true });
    expect(Math.max(...absoluteCells(g.state.active!).map((c) => c.x))).toBeLessThanOrEqual(9);
  });

  it('discards the rotation when no kick fits', () => {
    const g = started();
    // Vertical I in a 1-wide shaft: no horizontal rotation can fit.
    for (let y = 0; y < 20; y++) fillRow(g.state.board, y, [5]);
    setActive(g, { kind: 'I', rot: 1, pos: { x: 3, y: 8, z: 0 } });
    expect(collides(g.state.board, g.state.active!)).toBe(false);
    const before = structuredClone(g.state.active);
    expect(act(g, 'rotCW')).toEqual([]);
    expect(act(g, 'rotCCW')).toEqual([]);
    expect(g.state.active).toEqual(before);
  });

  it('O rotation is a no-op rotation event', () => {
    const g = started();
    setActive(g, { kind: 'O', rot: 0, pos: { x: 4, y: 10, z: 0 } });
    expect(act(g, 'rotCW')).toEqual([{ type: 'rotated', kicked: false }]);
  });
});

describe('hard drop (REQ-M3)', () => {
  it('drops to the lowest valid position, scores 2/cell and locks immediately', () => {
    const g = started();
    const ghost = g.ghost()!;
    const kind = g.state.active!.kind;
    const distance = g.state.active!.pos.y - ghost.pos.y;
    const ev = act(g, 'hardDrop');
    expect(ev[0]).toEqual({ type: 'hardDropped', distance });
    const locked = ev.find((e) => e.type === 'locked');
    expect(locked).toMatchObject({ kind, cells: absoluteCells(ghost) });
    expect(g.state.score).toBe(distance * 2);
    expect(types(ev)).toContain('spawned');
  });
});

describe('hold (REQ-M4)', () => {
  it('first hold takes the next piece; second hold in the same turn is ignored', () => {
    const g = started();
    const first = g.state.active!.kind;
    const next = g.preview()[0];
    const ev = act(g, 'hold');
    expect(types(ev)).toEqual(['held', 'spawned']);
    expect(g.state.hold).toBe(first);
    expect(g.state.active!.kind).toBe(next);
    expect(act(g, 'hold')).toEqual([]);
  });

  it('after locking, hold swaps with the stored piece', () => {
    const g = started();
    const first = g.state.active!.kind;
    act(g, 'hold');
    act(g, 'hardDrop');
    const current = g.state.active!.kind;
    act(g, 'hold');
    expect(g.state.active!.kind).toBe(first);
    expect(g.state.hold).toBe(current);
    expect(g.state.active!.pos).toEqual(g.spawnPosition(first));
  });
});

describe('lock delay (REQ-M6)', () => {
  it('locks LOCK_DELAY_MS after touching the ground', () => {
    const g = started();
    setActive(g, { kind: 'O', rot: 0, pos: { x: 4, y: 0, z: 0 } });
    expect(types(run(g, LOCK_DELAY_MS - 50))).not.toContain('locked');
    expect(types(run(g, 60))).toContain('locked');
  });

  it('successful moves reset the delay up to MAX_LOCK_RESETS times', () => {
    const g = started();
    setActive(g, { kind: 'O', rot: 0, pos: { x: 4, y: 0, z: 0 } });
    run(g, 100); // timer starts
    let lockedAt = -1;
    for (let i = 0; i < 40; i++) {
      const ev = [...act(g, i % 2 ? 'left' : 'right'), ...run(g, 400)];
      if (types(ev).includes('locked')) {
        lockedAt = i;
        break;
      }
    }
    // Without the cap it would never lock (400 < 500 between resets).
    expect(lockedAt).toBeGreaterThanOrEqual(MAX_LOCK_RESETS - 1);
    expect(lockedAt).toBeLessThanOrEqual(MAX_LOCK_RESETS + 1);
  });

  it('falling off a ledge cancels the lock timer', () => {
    const g = started();
    g.state.board[0]![4] = 'T';
    g.state.board[0]![5] = 'T';
    setActive(g, { kind: 'O', rot: 0, pos: { x: 4, y: 1, z: 0 } });
    run(g, 100);
    expect(g.state.lockTimer).not.toBeNull();
    act(g, 'right');
    act(g, 'right');
    act(g, 'right'); // now over empty columns 7..8
    run(g, STEP_MS);
    expect(g.state.lockTimer).toBeNull();
  });

  it('reaching a new lowest row resets the reset counter', () => {
    const g = started();
    setActive(g, { kind: 'O', rot: 0, pos: { x: 4, y: 5, z: 0 } });
    g.state.lockResets = 10;
    act(g, 'softDrop');
    expect(g.state.lockResets).toBe(0);
  });
});

describe('line clears, score and levels (REQ-S2, REQ-S3, REQ-S4)', () => {
  it('clears 4 lines with an I piece: 800 × level', () => {
    const g = started();
    for (let y = 0; y < 4; y++) fillRow(g.state.board, y, [9]);
    g.state.board[4]![0] = 'L';
    setActive(g, { kind: 'I', rot: 1, pos: { x: 7, y: 0, z: 0 } }); // vertical in column 9
    const ev = act(g, 'hardDrop');
    const cleared = ev.find((e) => e.type === 'linesCleared');
    expect(cleared).toMatchObject({ rows: [0, 1, 2, 3], count: 4 });
    expect(g.state.score).toBe(800);
    expect(g.state.lines).toBe(4);
    expect(g.state.board[0]![0]).toBe('L');
  });

  it('levels up every 10 lines and gravity speeds up', () => {
    const g = started();
    g.state.lines = 9;
    const slow = g.gravityMs();
    fillRow(g.state.board, 0, [0]);
    setActive(g, { kind: 'I', rot: 1, pos: { x: -2, y: 0, z: 0 } });
    const ev = act(g, 'hardDrop');
    expect(ev).toContainEqual({ type: 'levelUp', level: 2 });
    expect(g.state.level).toBe(2);
    expect(g.gravityMs()).toBeLessThan(slow);
  });

  it('line score multiplies by current level before leveling', () => {
    const g = new Game({ seed: 3, startLevel: 3 });
    g.start();
    fillRow(g.state.board, 0, [0]);
    setActive(g, { kind: 'I', rot: 1, pos: { x: -2, y: 0, z: 0 } });
    act(g, 'hardDrop');
    expect(g.state.score).toBe(300);
  });
});

describe('determinism (REQ-S1)', () => {
  function simulate(fps: number): number {
    const g = new Game({ seed: 11 });
    g.start();
    const stepper = new FixedStepper();
    const frame = 1000 / fps;
    let rowsFallen = 0;
    let lastY = g.state.active!.pos.y;
    for (let t = 0; t < 10_000 - 1e-6; t += frame) {
      const n = stepper.advance(frame);
      for (let i = 0; i < n; i++) {
        g.step(stepper.step);
        const y = g.state.active?.pos.y ?? lastY;
        if (y < lastY) rowsFallen += lastY - y;
        lastY = y;
      }
    }
    return rowsFallen;
  }

  it('the piece falls the same number of rows at 30 and 144 FPS', () => {
    const a = simulate(30);
    const b = simulate(144);
    expect(a).toBeGreaterThan(5);
    expect(a).toBe(b);
  });

  it('identical inputs produce identical states', () => {
    const play = () => {
      const g = new Game({ seed: 21 });
      g.start();
      const seq = ['left', 'rotCW', 'hardDrop', 'right', 'right', 'hold', 'hardDrop'] as const;
      for (const a of seq) {
        g.step(STEP_MS, { actions: [a], softDrop: false });
        run(g, 300);
      }
      return JSON.stringify(g.state);
    };
    expect(play()).toBe(play());
  });
});
