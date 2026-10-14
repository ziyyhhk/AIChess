/**
 * The local game archive behind the History view.
 *
 * Small on purpose: the last finished games (PGN + a few facts) are kept in
 * `localStorage` under one key. Everything here is defensive - a browser with
 * storage disabled, a corrupted entry or an old format must never break the app,
 * so every read is validated and every write is best-effort.
 */

export interface ArchivedGame {
  /** Stable id: when the game started, plus its ply count. */
  id: string;
  /** ISO timestamps. */
  startedAt: string;
  finishedAt: string;
  /** Names as they appeared in the PGN. */
  white: string;
  black: string;
  /** PGN result token: `1-0`, `0-1`, `1/2-1/2`, or `*` when unfinished. */
  result: string;
  /** Half-moves played. */
  plies: number;
  /** The colour the person at the keyboard played. */
  playerColor: 'w' | 'b';
  /** Full PGN, headers included, exactly as exported. */
  pgn: string;
  /** True when the game was abandoned rather than finished. */
  unfinished: boolean;
}

/** Minimal storage surface, so tests do not need a DOM. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const HISTORY_KEY = 'aichess-history';
export const MAX_ARCHIVED_GAMES = 40;

function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function isArchivedGame(value: unknown): value is ArchivedGame {
  if (!value || typeof value !== 'object') return false;
  const g = value as Record<string, unknown>;
  return (
    typeof g.id === 'string' &&
    typeof g.pgn === 'string' &&
    typeof g.result === 'string' &&
    typeof g.plies === 'number' &&
    typeof g.white === 'string' &&
    typeof g.black === 'string'
  );
}

/** Newest first. Unreadable storage or garbage entries yield an empty list. */
export function loadArchive(storage: StorageLike | null = defaultStorage()): ArchivedGame[] {
  if (!storage) return [];
  let raw: string | null = null;
  try {
    raw = storage.getItem(HISTORY_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isArchivedGame).slice(0, MAX_ARCHIVED_GAMES);
  } catch {
    return [];
  }
}

function persist(games: ArchivedGame[], storage: StorageLike | null): ArchivedGame[] {
  if (!storage) return games;
  try {
    storage.setItem(HISTORY_KEY, JSON.stringify(games));
  } catch {
    /* quota or private mode: the in-memory list is still returned */
  }
  return games;
}

/** Adds a game, newest first, replacing an entry with the same id. */
export function saveArchivedGame(
  entry: ArchivedGame,
  storage: StorageLike | null = defaultStorage()
): ArchivedGame[] {
  const existing = loadArchive(storage).filter((g) => g.id !== entry.id);
  return persist([entry, ...existing].slice(0, MAX_ARCHIVED_GAMES), storage);
}

export function deleteArchivedGame(
  id: string,
  storage: StorageLike | null = defaultStorage()
): ArchivedGame[] {
  return persist(
    loadArchive(storage).filter((g) => g.id !== id),
    storage
  );
}

export function clearArchive(storage: StorageLike | null = defaultStorage()): ArchivedGame[] {
  if (storage) {
    try {
      storage.removeItem(HISTORY_KEY);
    } catch {
      /* ignore */
    }
  }
  return [];
}

/** A single game is worth keeping once a real game has been played. */
export function shouldArchive(plies: number): boolean {
  return plies >= 2;
}

/** Human-readable one-liner for a list row. */
export function describeResult(entry: ArchivedGame): string {
  if (entry.result === '*' || entry.unfinished) return 'Unfinished';
  if (entry.result === '1/2-1/2') return 'Draw';
  const playerWon =
    (entry.result === '1-0' && entry.playerColor !== 'b') || (entry.result === '0-1' && entry.playerColor === 'b');
  return playerWon ? 'You won' : 'You lost';
}

/** Short local date+time, falling back to the raw ISO string when unparseable. */
export function formatPlayed(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
