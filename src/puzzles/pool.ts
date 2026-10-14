/**
 * Puzzle selection: a committed pool of generated mate-in-one positions, dealt
 * without repeats for as long as the pool lasts.
 *
 * The pool is built offline by scripts/build-puzzle-pool.ts (seeded, so the file
 * is reproducible). The curated catalog is kept only as a fallback. Runtime
 * generation is too slow to run on a click, which is why the pool exists.
 *
 * "Seen" history is a per-viewer convenience in localStorage. Every access is
 * wrapped, because storage can be blocked or full, and the picker still works
 * without it. Nothing here needs to survive a reset to be correct.
 */
import generatedPool from './generatedPool.json';
import { PUZZLE_CATALOG, type PuzzleDef } from './catalog';
import { filterValidPuzzles } from './validate';

export const HISTORY_KEY = 'aichess-puzzle-history';
/** How many recent puzzle ids are remembered before the oldest can come back. */
export const HISTORY_LIMIT = 400;

const POOL: PuzzleDef[] = generatedPool as PuzzleDef[];
let validPool: PuzzleDef[] | null = null;

/** The usable pool, validated once per session. */
export function usablePool(): PuzzleDef[] {
  if (!validPool) validPool = filterValidPuzzles(POOL);
  return validPool;
}

export function loadPuzzleHistory(): string[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function savePuzzleHistory(ids: string[]): void {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(ids.slice(-HISTORY_LIMIT)));
  } catch {
    // Storage blocked or full: the next deal simply cannot see this history.
  }
}

/**
 * Pick the next puzzle, preferring ones not in `history`. When the pool is
 * exhausted the oldest entries are allowed back. Returns the puzzle and the
 * updated history, so the caller decides whether to persist it.
 */
export function dealPuzzle(
  rng: () => number = Math.random,
  history: string[] = loadPuzzleHistory()
): { puzzle: PuzzleDef; history: string[] } | null {
  const pool = usablePool();
  const source = pool.length ? pool : filterValidPuzzles(PUZZLE_CATALOG);
  if (!source.length) return null;

  const recent = new Set(history.slice(-HISTORY_LIMIT));
  let candidates = source.filter((p) => !recent.has(p.id));
  if (!candidates.length) {
    // Everything has been seen recently: restart the cycle, keeping the last one out.
    const last = history[history.length - 1];
    candidates = source.filter((p) => p.id !== last);
    if (!candidates.length) candidates = source;
  }

  const puzzle = candidates[Math.floor(rng() * candidates.length)];
  const nextHistory = [...history, puzzle.id].slice(-HISTORY_LIMIT);
  return { puzzle, history: nextHistory };
}

/** Deal and remember, for the UI. */
export function nextPuzzle(): PuzzleDef | null {
  const dealt = dealPuzzle();
  if (!dealt) return null;
  savePuzzleHistory(dealt.history);
  return dealt.puzzle;
}
