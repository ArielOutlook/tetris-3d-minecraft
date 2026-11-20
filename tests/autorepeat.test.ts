import { describe, expect, it } from 'vitest';
import { AutoRepeat } from '../src/input/autorepeat';

describe('AutoRepeat (REQ-M5)', () => {
  it('moves once on press, waits DAS, then repeats every ARR', () => {
    const ar = new AutoRepeat(170, 50);
    expect(ar.press('right')).toEqual(['right']);
    expect(ar.update(169)).toEqual([]);
    expect(ar.update(1)).toEqual(['right']);
    expect(ar.update(49)).toEqual([]);
    expect(ar.update(1)).toEqual(['right']);
    expect(ar.update(100)).toEqual(['right', 'right']);
  });

  it('holding 1 s yields enough moves to cross a 10-wide well', () => {
    const ar = new AutoRepeat(170, 50);
    let moves = ar.press('right').length;
    for (let t = 0; t < 1000; t += 1000 / 60) moves += ar.update(1000 / 60).length;
    expect(moves).toBeGreaterThanOrEqual(10);
  });

  it('ignores repeated press of a held key (OS auto-repeat)', () => {
    const ar = new AutoRepeat(170, 50);
    ar.press('left');
    expect(ar.press('left')).toEqual([]);
  });

  it('last pressed direction wins and falls back on release', () => {
    const ar = new AutoRepeat(170, 50);
    ar.press('left');
    ar.press('right');
    expect(ar.active).toBe('right');
    ar.release('right');
    expect(ar.active).toBe('left');
    ar.release('left');
    expect(ar.active).toBeNull();
    expect(ar.update(500)).toEqual([]);
  });

  it('releasing the inactive direction keeps the active one', () => {
    const ar = new AutoRepeat(170, 50);
    ar.press('left');
    ar.press('right');
    ar.release('left');
    expect(ar.active).toBe('right');
    ar.releaseAll();
    expect(ar.active).toBeNull();
  });

  it('caps moves per update', () => {
    const ar = new AutoRepeat(0, 1, 5);
    ar.press('left');
    expect(ar.update(1000)).toHaveLength(5);
  });
});
