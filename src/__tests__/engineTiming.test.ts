import { describe, it, expect } from 'vitest';
import { buildGoCommand, difficultyToSettings } from '../ai/providers/stockfishAdapter';
import {
  DEFAULT_MIN_THINK_MS,
  MIN_THINK_CHOICES,
  clampMinThinkMs,
  remainingThinkDelay,
} from '../ai/thinkTime';

describe('buildGoCommand', () => {
  it('searches for a fixed time with no depth cap', () => {
    // A depth cap ends the search early, which is why the AI used to reply instantly.
    expect(buildGoCommand(1200)).toBe('go movetime 1200');
    expect(buildGoCommand(1200)).not.toMatch(/depth/);
  });

  it('never asks for a search shorter than 100 ms', () => {
    expect(buildGoCommand(5)).toBe('go movetime 100');
  });
});

describe('difficulty think times', () => {
  it('gives every built-in level at least 900 ms of search', () => {
    for (const d of ['beginner', 'easy', 'medium', 'hard', 'expert'] as const) {
      expect(difficultyToSettings(d).movetime).toBeGreaterThanOrEqual(900);
    }
  });

  it('gives stronger levels more time', () => {
    expect(difficultyToSettings('expert').movetime).toBeGreaterThan(
      difficultyToSettings('beginner').movetime
    );
  });
});

describe('remainingThinkDelay', () => {
  it('waits out the rest of the minimum when the reply came early', () => {
    expect(remainingThinkDelay(300, 1200)).toBe(900);
  });

  it('adds no wait when the reply already took the minimum', () => {
    expect(remainingThinkDelay(2500, 1200)).toBe(0);
  });

  it('adds no wait when the minimum is zero', () => {
    expect(remainingThinkDelay(10, 0)).toBe(0);
  });

  it('falls back to the default minimum for a bad setting', () => {
    expect(remainingThinkDelay(0, Number.NaN)).toBe(DEFAULT_MIN_THINK_MS);
  });
});

describe('clampMinThinkMs', () => {
  it('keeps values between 0 and 10 seconds', () => {
    expect(clampMinThinkMs(-50)).toBe(0);
    expect(clampMinThinkMs(99_999)).toBe(10_000);
    expect(clampMinThinkMs(1500.4)).toBe(1500);
  });

  it('offers the default as one of the Settings choices', () => {
    expect(MIN_THINK_CHOICES.map((c) => c.ms)).toContain(DEFAULT_MIN_THINK_MS);
  });
});
