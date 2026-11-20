import { STORAGE_KEYS } from '../config';

export interface HighscoreEntry {
  score: number;
  level: number;
  lines: number;
  /** ISO date string. */
  date: string;
}

export type Quality = 'alto' | 'bajo';

export interface Settings {
  muted: boolean;
  quality: Quality;
}

export const MAX_HIGHSCORES = 5;
export const DEFAULT_SETTINGS: Settings = { muted: false, quality: 'alto' };

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** Returns window.localStorage if usable, otherwise null (private mode, disabled cookies…). */
export function safeStorage(): StorageLike | null {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = '__bloquecaida_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

function readJson(storage: StorageLike | null, key: string): unknown {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function writeJson(storage: StorageLike | null, key: string, value: unknown): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function isEntry(v: unknown): v is HighscoreEntry {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.score === 'number' &&
    typeof e.level === 'number' &&
    typeof e.lines === 'number' &&
    typeof e.date === 'string'
  );
}

export function loadHighscores(storage: StorageLike | null): HighscoreEntry[] {
  const data = readJson(storage, STORAGE_KEYS.highscores);
  if (!Array.isArray(data)) return [];
  return data
    .filter(isEntry)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_HIGHSCORES);
}

/** True when `score` would enter the top list. A tie with the last place does not enter (the older entry keeps it). */
export function qualifies(list: readonly HighscoreEntry[], score: number): boolean {
  if (score <= 0) return false;
  if (list.length < MAX_HIGHSCORES) return true;
  return score > (list[list.length - 1]?.score ?? 0);
}

/**
 * Inserts an entry if it qualifies. Returns the new list and the 0-based rank (or -1).
 * Works (in memory) even when storage is unavailable.
 */
export function addHighscore(
  storage: StorageLike | null,
  entry: HighscoreEntry,
): { list: HighscoreEntry[]; rank: number } {
  const list = loadHighscores(storage);
  if (!qualifies(list, entry.score)) return { list, rank: -1 };
  const next = [...list, entry].sort((a, b) => b.score - a.score).slice(0, MAX_HIGHSCORES);
  writeJson(storage, STORAGE_KEYS.highscores, next);
  return { list: next, rank: next.indexOf(entry) };
}

export function loadSettings(storage: StorageLike | null): Settings {
  const data = readJson(storage, STORAGE_KEYS.settings);
  if (typeof data !== 'object' || data === null) return { ...DEFAULT_SETTINGS };
  const d = data as Record<string, unknown>;
  return {
    muted: typeof d.muted === 'boolean' ? d.muted : DEFAULT_SETTINGS.muted,
    quality: d.quality === 'bajo' || d.quality === 'alto' ? d.quality : DEFAULT_SETTINGS.quality,
  };
}

export function saveSettings(storage: StorageLike | null, settings: Settings): boolean {
  return writeJson(storage, STORAGE_KEYS.settings, settings);
}
