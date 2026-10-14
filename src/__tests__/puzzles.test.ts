import { describe, it, expect } from 'vitest';
import { PUZZLE_CATALOG } from '../puzzles/catalog';
import { filterValidPuzzles, isAcceptedMove, validatePuzzle } from '../puzzles/validate';
import { applyAttempt, EMPTY_STATS, performanceScore, updateRating } from '../puzzles/rating';

describe('puzzle validation', () => {
  it('keeps only puzzles whose solutions are legal and meet the objective', () => {
    const valid = filterValidPuzzles(PUZZLE_CATALOG);
    expect(valid.length).toBeGreaterThan(0);
    for (const p of valid) {
      expect(validatePuzzle(p).ok).toBe(true);
    }
  });

  it('accepts the primary solution move at step 0', () => {
    const valid = filterValidPuzzles(PUZZLE_CATALOG);
    const p = valid[0];
    expect(isAcceptedMove(p, 0, p.solution[0].uci)).toBe(true);
    expect(isAcceptedMove(p, 0, 'a2a3')).toBe(false);
  });
});

describe('puzzle rating', () => {
  it('gives full performance only for a clean solve', () => {
    expect(performanceScore({ solved: true, incorrectAttempts: 0, hintsUsed: 0 })).toBe(1);
    expect(performanceScore({ solved: false, incorrectAttempts: 1, hintsUsed: 0 })).toBe(0);
    expect(
      performanceScore({ solved: true, incorrectAttempts: 2, hintsUsed: 1 })
    ).toBeLessThan(1);
  });

  it('raises rating after solving a harder puzzle', () => {
    const before = EMPTY_STATS.rating;
    const after = updateRating(EMPTY_STATS, 1400, 1);
    expect(after).toBeGreaterThan(before);
  });

  it('records attempts in history', () => {
    const next = applyAttempt(EMPTY_STATS, {
      puzzleId: 't',
      puzzleRating: 1000,
      solved: true,
      incorrectAttempts: 0,
      hintsUsed: 0,
    });
    expect(next.solved).toBe(1);
    expect(next.history).toHaveLength(1);
  });
});
