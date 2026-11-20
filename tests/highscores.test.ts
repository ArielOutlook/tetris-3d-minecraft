import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../src/config';
import {
  addHighscore,
  DEFAULT_SETTINGS,
  loadHighscores,
  loadSettings,
  qualifies,
  safeStorage,
  saveSettings,
  type HighscoreEntry,
} from '../src/storage/highscores';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

const throwing = {
  getItem(): string | null {
    throw new Error('denied');
  },
  setItem(): void {
    throw new Error('denied');
  },
};

const entry = (score: number): HighscoreEntry => ({ score, level: 1, lines: 0, date: '2026-11-19' });

describe('highscores (REQ-S6)', () => {
  it('keeps the top 5 sorted', () => {
    const s = new MemoryStorage();
    for (const sc of [100, 500, 300, 900, 200, 700]) addHighscore(s, entry(sc));
    expect(loadHighscores(s).map((e) => e.score)).toEqual([900, 700, 500, 300, 200]);
    const r = addHighscore(s, entry(50));
    expect(r.rank).toBe(-1);
    expect(addHighscore(s, entry(800)).rank).toBe(1);
  });

  it('qualifies rules', () => {
    expect(qualifies([], 0)).toBe(false);
    expect(qualifies([], 10)).toBe(true);
  });

  it('ignores corrupt data', () => {
    const s = new MemoryStorage();
    s.setItem(STORAGE_KEYS.highscores, '{not json');
    expect(loadHighscores(s)).toEqual([]);
    s.setItem(STORAGE_KEYS.highscores, JSON.stringify([{ score: 'x' }, entry(10)]));
    expect(loadHighscores(s)).toEqual([entry(10)]);
    s.setItem(STORAGE_KEYS.highscores, JSON.stringify({ a: 1 }));
    expect(loadHighscores(s)).toEqual([]);
  });

  it('keeps working when storage throws or is missing', () => {
    expect(loadHighscores(throwing)).toEqual([]);
    expect(addHighscore(throwing, entry(100))).toEqual({ list: [entry(100)], rank: 0 });
    expect(addHighscore(null, entry(100)).rank).toBe(0);
    expect(loadSettings(throwing)).toEqual(DEFAULT_SETTINGS);
    expect(saveSettings(throwing, DEFAULT_SETTINGS)).toBe(false);
    expect(saveSettings(null, DEFAULT_SETTINGS)).toBe(false);
  });

  it('safeStorage returns null without localStorage (node)', () => {
    expect(safeStorage()).toBeNull();
  });

  it('safeStorage returns storage when it works and null when it throws', () => {
    const g = globalThis as { localStorage?: unknown };
    g.localStorage = new MemoryStorage();
    expect(safeStorage()).toBe(g.localStorage);
    g.localStorage = { setItem: throwing.setItem, removeItem() {}, getItem: throwing.getItem };
    expect(safeStorage()).toBeNull();
    delete g.localStorage;
  });
});

describe('settings', () => {
  it('round-trips and validates', () => {
    const s = new MemoryStorage();
    expect(loadSettings(s)).toEqual(DEFAULT_SETTINGS);
    expect(saveSettings(s, { muted: true, quality: 'bajo' })).toBe(true);
    expect(loadSettings(s)).toEqual({ muted: true, quality: 'bajo' });
    s.setItem(STORAGE_KEYS.settings, JSON.stringify({ muted: 'yes', quality: 'ultra' }));
    expect(loadSettings(s)).toEqual(DEFAULT_SETTINGS);
  });
});
