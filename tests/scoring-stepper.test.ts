import { describe, expect, it } from 'vitest';
import { gravityInterval, levelForLines, lineClearScore } from '../src/core/scoring';
import { FixedStepper } from '../src/core/stepper';

describe('scoring (REQ-S3, REQ-S4)', () => {
  it('line clear points scale with level', () => {
    expect(lineClearScore(1, 1)).toBe(100);
    expect(lineClearScore(2, 1)).toBe(300);
    expect(lineClearScore(3, 1)).toBe(500);
    expect(lineClearScore(4, 1)).toBe(800);
    expect(lineClearScore(4, 3)).toBe(2400);
    expect(lineClearScore(0, 5)).toBe(0);
  });

  it('level rises every 10 lines', () => {
    expect(levelForLines(0)).toBe(1);
    expect(levelForLines(9)).toBe(1);
    expect(levelForLines(10)).toBe(2);
    expect(levelForLines(35)).toBe(4);
    expect(levelForLines(5, 3)).toBe(3);
  });

  it('gravity curve: 1000 ms at level 1, monotonically faster, floor 50 ms', () => {
    expect(gravityInterval(1)).toBe(1000);
    for (let l = 2; l < 30; l++) expect(gravityInterval(l)).toBeLessThanOrEqual(gravityInterval(l - 1));
    expect(gravityInterval(99)).toBe(50);
    expect(gravityInterval(0)).toBe(1000);
  });
});

describe('FixedStepper (REQ-S1)', () => {
  it('converts frame time into constant steps', () => {
    const s = new FixedStepper(10, 250);
    expect(s.step).toBe(10);
    expect(s.advance(5)).toBe(0);
    expect(s.advance(5)).toBe(1);
    expect(s.advance(35)).toBe(3);
    expect(s.advance(1000)).toBe(25); // clamped to 250 ms (+5 carried)
    s.reset();
    expect(s.advance(9)).toBe(0);
    expect(s.advance(-50)).toBe(0);
  });
});
