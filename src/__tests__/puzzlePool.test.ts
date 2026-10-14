// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chess } from 'chess.js';
import {
  findUniqueMateInOne,
  generateMateInOne,
  mulberry32,
  positionKey,
} from '../puzzles/generator';
import {
  HISTORY_KEY,
  HISTORY_LIMIT,
  dealPuzzle,
  loadPuzzleHistory,
  savePuzzleHistory,
  usablePool,
} from '../puzzles/pool';
import { PUZZLE_CATALOG } from '../puzzles/catalog';
import { validatePuzzle } from '../puzzles/validate';

describe('seeded randomness', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 50; i++) expect(a()).toBe(b());
  });

  it('stays in [0, 1) and differs between seeds', () => {
    const r = mulberry32(7);
    const values = Array.from({ length: 200 }, () => r());
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('findUniqueMateInOne', () => {
  it('finds the single back-rank mate', () => {
    const chess = new Chess('6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1');
    expect(findUniqueMateInOne(chess)).toBe('e1e8');
  });

  it('returns null when two different moves both mate', () => {
    // Ra8# and Rb8# are both back-rank mates against Kh8 with g7 and h7 pawns.
    const chess = new Chess('7k/6pp/8/8/8/8/8/RR4K1 w - - 0 1');
    expect(findUniqueMateInOne(chess)).toBeNull();
  });

  it('leaves the position exactly as it found it', () => {
    const fen = '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1';
    const chess = new Chess(fen);
    findUniqueMateInOne(chess);
    expect(chess.fen()).toBe(fen);
  });
});

describe('generateMateInOne', () => {
  it('returns a puzzle whose only mate is the stored solution', () => {
    const puzzle = generateMateInOne({ rng: mulberry32(11) });
    expect(puzzle).not.toBeNull();
    if (!puzzle) return;
    expect(validatePuzzle(puzzle).ok).toBe(true);
    expect(puzzle.theme).toBe('mateIn1');
    expect(puzzle.sideToMove).toBe('w');
    expect(findUniqueMateInOne(new Chess(puzzle.fen))).toBe(puzzle.solution[0].uci);
    expect(puzzle.rating).toBeGreaterThanOrEqual(650);
    expect(puzzle.rating).toBeLessThanOrEqual(1200);
  }, 60_000);

  it('is repeatable for a fixed seed', () => {
    const first = generateMateInOne({ rng: mulberry32(23) });
    const second = generateMateInOne({ rng: mulberry32(23) });
    expect(first).not.toBeNull();
    expect(second).toEqual(first);
  }, 60_000);

  it('skips positions the caller has already seen', () => {
    const first = generateMateInOne({ rng: mulberry32(5) });
    expect(first).not.toBeNull();
    if (!first) return;
    const next = generateMateInOne({
      rng: mulberry32(5),
      avoid: new Set([positionKey(first.fen)]),
    });
    expect(next).not.toBeNull();
    expect(positionKey(next!.fen)).not.toBe(positionKey(first.fen));
  }, 60_000);

  it('derives the id from the position, so the same position always gets the same id', () => {
    const p = generateMateInOne({ rng: mulberry32(31) });
    expect(p).not.toBeNull();
    if (!p) return;
    expect(p.id).toMatch(/^gen-[0-9a-z]+$/);
    expect(p.id).toBe(generateMateInOne({ rng: mulberry32(31) })?.id);
  }, 60_000);
});

describe('puzzle pool', () => {
  const pool = usablePool();

  it('ships a substantial pool of valid puzzles', () => {
    expect(pool.length).toBeGreaterThanOrEqual(200);
    expect(pool.every((p) => validatePuzzle(p).ok)).toBe(true);
  });

  it('has no repeated ids or repeated positions', () => {
    expect(new Set(pool.map((p) => p.id)).size).toBe(pool.length);
    expect(new Set(pool.map((p) => positionKey(p.fen))).size).toBe(pool.length);
  });

  it('gives every puzzle exactly one mating move, matching its solution', () => {
    for (const p of pool) {
      expect(findUniqueMateInOne(new Chess(p.fen)), p.id).toBe(p.solution[0].uci);
    }
  }, 120_000);

  it('differs from the curated catalog in position, not just id', () => {
    const catalogKeys = new Set(PUZZLE_CATALOG.map((p) => positionKey(p.fen)));
    const overlap = pool.filter((p) => catalogKeys.has(positionKey(p.fen)));
    expect(overlap.length).toBe(0);
  });
});

describe('dealing without repeats', () => {
  it('deals distinct puzzles while the pool lasts', () => {
    const rng = mulberry32(99);
    let history: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const dealt = dealPuzzle(rng, history);
      expect(dealt).not.toBeNull();
      if (!dealt) return;
      expect(seen.has(dealt.puzzle.id)).toBe(false);
      seen.add(dealt.puzzle.id);
      history = dealt.history;
    }
  });

  it('never offers a puzzle from recent history while others remain', () => {
    const pool = usablePool();
    const keep = pool[0];
    const history = pool.filter((p) => p.id !== keep.id).map((p) => p.id);
    for (let seed = 1; seed <= 10; seed++) {
      const dealt = dealPuzzle(mulberry32(seed), history);
      expect(dealt?.puzzle.id).toBe(keep.id);
    }
  });

  it('restarts the cycle when everything has been seen, avoiding the last one shown', () => {
    const pool = usablePool();
    const history = pool.map((p) => p.id);
    const last = history[history.length - 1];
    for (let seed = 1; seed <= 10; seed++) {
      const dealt = dealPuzzle(mulberry32(seed), history);
      expect(dealt).not.toBeNull();
      expect(dealt!.puzzle.id).not.toBe(last);
    }
  });
});

describe('history storage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.removeItem(HISTORY_KEY);
  });

  it('keeps only the most recent entries', () => {
    savePuzzleHistory(Array.from({ length: HISTORY_LIMIT + 50 }, (_, i) => `id-${i}`));
    const loaded = loadPuzzleHistory();
    expect(loaded.length).toBe(HISTORY_LIMIT);
    expect(loaded[loaded.length - 1]).toBe(`id-${HISTORY_LIMIT + 49}`);
  });

  it('treats unreadable storage as an empty history instead of failing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadPuzzleHistory()).toEqual([]);
  });

  it('ignores a corrupted history value', () => {
    window.localStorage.setItem(HISTORY_KEY, '{not json');
    expect(loadPuzzleHistory()).toEqual([]);
  });

  it('does not throw when writing fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    expect(() => savePuzzleHistory(['a'])).not.toThrow();
  });
});
