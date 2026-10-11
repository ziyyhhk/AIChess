import { describe, it, expect } from 'vitest';
import {
  DEFAULT_THINK_SETTINGS,
  THINK_RANGES,
  clampCustomThinkMs,
  pickThinkTargetMs,
  remainingThinkDelay,
  thinkSettingsFromLegacy,
} from '../ai/thinkTime';

describe('AI thinking time', () => {
  it('spends longer on harder difficulties', () => {
    const zero = () => 0;
    expect(pickThinkTargetMs('beginner', DEFAULT_THINK_SETTINGS, zero)).toBe(THINK_RANGES.beginner.min);
    expect(pickThinkTargetMs('expert', DEFAULT_THINK_SETTINGS, zero)).toBe(THINK_RANGES.expert.min);
    expect(THINK_RANGES.expert.min).toBeGreaterThan(THINK_RANGES.beginner.min);
    expect(THINK_RANGES.expert.max).toBeGreaterThan(THINK_RANGES.beginner.max);
  });

  it('varies within the difficulty range', () => {
    const low = pickThinkTargetMs('medium', DEFAULT_THINK_SETTINGS, () => 0);
    const high = pickThinkTargetMs('medium', DEFAULT_THINK_SETTINGS, () => 1);
    expect(low).toBe(THINK_RANGES.medium.min);
    expect(high).toBe(THINK_RANGES.medium.max);
    // Mild randomness: never the same for every reply, never extreme.
    const mid = pickThinkTargetMs('medium', DEFAULT_THINK_SETTINGS, () => 0.5);
    expect(mid).toBeGreaterThan(low);
    expect(mid).toBeLessThan(high);
  });

  it('honours the instant mode', () => {
    expect(pickThinkTargetMs('expert', { mode: 'instant', customMs: 3000 })).toBe(0);
  });

  it('uses the custom delay when asked', () => {
    expect(pickThinkTargetMs('beginner', { mode: 'custom', customMs: 2500 })).toBe(2500);
    expect(clampCustomThinkMs(-100)).toBe(0);
    expect(clampCustomThinkMs(999999)).toBeLessThanOrEqual(10000);
  });

  it('never delays an engine that was already slower than the target', () => {
    // 2.4 s of engine time against a 1.2 s target: no extra waiting at all.
    expect(remainingThinkDelay(2400, 1200)).toBe(0);
    // 0.4 s of engine time against a 1.2 s target: wait the remaining 0.8 s.
    expect(remainingThinkDelay(400, 1200)).toBe(800);
  });

  it('waits the whole target when no time has passed', () => {
    expect(remainingThinkDelay(0, 1500)).toBe(1500);
    expect(remainingThinkDelay(Number.NaN, 1500)).toBe(1500);
  });

  it('never reports a negative wait', () => {
    expect(remainingThinkDelay(5000, 0)).toBe(0);
  });

  it('migrates settings saved before thinking modes existed', () => {
    expect(thinkSettingsFromLegacy(1200)).toEqual({ mode: 'custom', customMs: 1200 });
    expect(thinkSettingsFromLegacy(0)).toEqual({ mode: 'instant', customMs: DEFAULT_THINK_SETTINGS.customMs });
    expect(thinkSettingsFromLegacy(undefined)).toEqual(DEFAULT_THINK_SETTINGS);
  });
});
