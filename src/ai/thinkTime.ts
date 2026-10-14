/**
 * How long an AI opponent takes to reply.
 *
 * The engine/model result is requested immediately. While it is in flight the
 * player can queue a premove. Once a legal move exists, the app waits until the
 * *target* thinking time has elapsed:
 *
 *     wait = max(engine response time, target thinking time)
 *
 * so a slow engine is never delayed further, and a very fast one still gives the
 * player a moment to set up a premove. Targets are drawn from a range per
 * difficulty so consecutive moves do not all take exactly the same time. This is
 * presentation pacing only - it never changes what the engine searched.
 */
import type { StockfishDifficulty } from './providers/stockfishAdapter';

export type ThinkMode = 'instant' | 'natural' | 'custom';

export interface ThinkTimeSettings {
  mode: ThinkMode;
  /** Used when mode is 'custom'. */
  customMs: number;
}

export const DEFAULT_THINK_SETTINGS: ThinkTimeSettings = {
  mode: 'natural',
  customMs: 1200,
};

export const THINK_TARGET_MIN_MS = 0;
export const THINK_TARGET_MAX_MS = 10_000;

/** Suggested pacing per difficulty, in milliseconds. */
export const THINK_RANGES: Record<StockfishDifficulty, { min: number; max: number }> = {
  beginner: { min: 700, max: 1200 },
  easy: { min: 800, max: 1500 },
  medium: { min: 1000, max: 2000 },
  hard: { min: 1200, max: 2700 },
  expert: { min: 1500, max: 3500 },
  custom: { min: 700, max: 2000 },
};

export const THINK_MODE_LABELS: Record<ThinkMode, string> = {
  instant: 'Instant (as fast as the engine can)',
  natural: 'Natural (varies with difficulty)',
  custom: 'Custom delay',
};

export function clampCustomThinkMs(ms: number): number {
  if (!Number.isFinite(ms)) return DEFAULT_THINK_SETTINGS.customMs;
  return Math.min(THINK_TARGET_MAX_MS, Math.max(THINK_TARGET_MIN_MS, Math.round(ms)));
}

/**
 * The thinking time to aim for, in ms. `random` is injectable so the pacing
 * logic is testable.
 */
export function pickThinkTargetMs(
  difficulty: StockfishDifficulty | string,
  settings: ThinkTimeSettings,
  random: () => number = Math.random
): number {
  if (settings.mode === 'instant') return 0;
  if (settings.mode === 'custom') return clampCustomThinkMs(settings.customMs);
  const range = THINK_RANGES[difficulty as StockfishDifficulty] ?? THINK_RANGES.medium;
  const t = Math.min(1, Math.max(0, random()));
  return Math.round(range.min + (range.max - range.min) * t);
}

/** Milliseconds still to wait so the total think time reaches `targetMs`. */
export function remainingThinkDelay(elapsedMs: number, targetMs: number): number {
  if (!Number.isFinite(elapsedMs)) return Math.max(0, Math.round(targetMs));
  return Math.max(0, Math.ceil(targetMs - elapsedMs));
}

/** True when the AI should wait at all. */
export function shouldWait(targetMs: number): boolean {
  return targetMs > 0;
}

/** Migrate older saved settings that only had a `minThinkMs` number. */
export function thinkSettingsFromLegacy(minThinkMs: unknown): ThinkTimeSettings {
  if (typeof minThinkMs === 'number' && Number.isFinite(minThinkMs)) {
    if (minThinkMs <= 0) return { mode: 'instant', customMs: DEFAULT_THINK_SETTINGS.customMs };
    return { mode: 'custom', customMs: clampCustomThinkMs(minThinkMs) };
  }
  return { ...DEFAULT_THINK_SETTINGS };
}
