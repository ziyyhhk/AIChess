import { describe, it, expect } from 'vitest';
import { difficultyToSettings } from '../ai/providers/stockfishAdapter';

describe('difficultyToSettings', () => {
  it('makes beginner weaker than expert', () => {
    const b = difficultyToSettings('beginner');
    const e = difficultyToSettings('expert');
    expect(b.skill).toBeLessThan(e.skill);
    expect(b.depth).toBeLessThan(e.depth);
    expect(b.movetime).toBeLessThan(e.movetime);
  });

  it('easy is weaker than hard', () => {
    const easy = difficultyToSettings('easy');
    const hard = difficultyToSettings('hard');
    expect(easy.skill).toBeLessThan(hard.skill);
  });

  it('custom uses provided options', () => {
    const c = difficultyToSettings('custom', {
      skillLevel: 7,
      depth: 5,
      movetimeMs: 200,
    });
    expect(c.skill).toBe(7);
    expect(c.depth).toBe(5);
    expect(c.movetime).toBe(200);
  });
});
