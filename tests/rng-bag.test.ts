import { describe, expect, it } from 'vitest';
import { Bag } from '../src/core/bag';
import { mulberry32, randomSeed } from '../src/core/rng';
import { PIECE_KINDS } from '../src/core/types';

describe('mulberry32', () => {
  it('is deterministic and within [0,1)', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('randomSeed returns a uint32', () => {
    const s = randomSeed();
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
  });
});

describe('Bag (REQ-G3)', () => {
  it('every batch of 7 contains each shape exactly once', () => {
    const bag = new Bag(mulberry32(123));
    for (let batch = 0; batch < 10; batch++) {
      const seen = Array.from({ length: 7 }, () => bag.next());
      expect([...seen].sort()).toEqual([...PIECE_KINDS].sort());
    }
  });

  it('same seed produces the same sequence', () => {
    const a = new Bag(mulberry32(99));
    const b = new Bag(mulberry32(99));
    const sa = Array.from({ length: 14 }, () => a.next());
    const sb = Array.from({ length: 14 }, () => b.next());
    expect(sa).toEqual(sb);
  });

  it('different seeds usually differ', () => {
    const a = new Bag(mulberry32(1));
    const b = new Bag(mulberry32(2));
    const sa = Array.from({ length: 14 }, () => a.next()).join('');
    const sb = Array.from({ length: 14 }, () => b.next()).join('');
    expect(sa).not.toBe(sb);
  });
});
