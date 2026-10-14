import { describe, expect, it } from 'vitest';
import {
  DIFFICULTY_ORDER,
  difficultyToSettings,
} from '../ai/providers/stockfishAdapter';

describe('difficultyToSettings', () => {
  it('returns complete profiles for every difficulty', () => {
    for (const d of DIFFICULTY_ORDER) {
      const s = difficultyToSettings(d);
      expect(s.skill).toBeGreaterThanOrEqual(0);
      expect(s.skill).toBeLessThanOrEqual(20);
      expect(s.depth).toBeGreaterThan(0);
      expect(s.movetime).toBeGreaterThan(0);
      expect(s.targetRating).toBeGreaterThan(0);
      expect(s.randomMoveChance).toBeGreaterThanOrEqual(0);
      expect(s.weakerLineChance).toBeGreaterThanOrEqual(0);
    }
  });

  it('orders levels so each is weaker than the next', () => {
    for (let i = 0; i < DIFFICULTY_ORDER.length - 1; i++) {
      const a = difficultyToSettings(DIFFICULTY_ORDER[i]);
      const b = difficultyToSettings(DIFFICULTY_ORDER[i + 1]);
      expect(a.skill + a.depth).toBeLessThanOrEqual(b.skill + b.depth);
      expect(a.targetRating).toBeLessThan(b.targetRating);
      expect(a.randomMoveChance).toBeGreaterThanOrEqual(b.randomMoveChance);
    }
  });

  it('beginner is very weak', () => {
    const b = difficultyToSettings('beginner');
    expect(b.skill).toBe(0);
    expect(b.elo).toBeLessThanOrEqual(800);
    expect(b.randomMoveChance).toBeGreaterThan(0.2);
    expect(b.depth).toBeLessThanOrEqual(2);
  });

  it('expert is strong', () => {
    const e = difficultyToSettings('expert');
    expect(e.skill).toBeGreaterThanOrEqual(15);
    expect(e.randomMoveChance).toBe(0);
    expect(e.limitStrength).toBe(false);
  });

  it('custom uses provided options', () => {
    const c = difficultyToSettings('custom', { skillLevel: 7, depth: 5, movetimeMs: 800 });
    expect(c.skill).toBe(7);
    expect(c.depth).toBe(5);
    expect(c.movetime).toBe(800);
  });
});
