/**
 * Minimum time an AI spends "thinking" before its move is shown.
 *
 * A reply that lands in a few hundred milliseconds leaves no window to queue a
 * premove, so every opponent (built-in Stockfish and hosted models alike) waits
 * at least this long. The player can change it in Settings (AppSettings.minThinkMs).
 */
export const DEFAULT_MIN_THINK_MS = 1200;

const MAX_MIN_THINK_MS = 10_000;

export const MIN_THINK_CHOICES: readonly { ms: number; label: string }[] = [
  { ms: 0, label: 'No delay' },
  { ms: 1200, label: '1.2 seconds (default)' },
  { ms: 2000, label: '2 seconds' },
  { ms: 3000, label: '3 seconds' },
];

export function clampMinThinkMs(ms: number): number {
  if (!Number.isFinite(ms)) return DEFAULT_MIN_THINK_MS;
  return Math.min(MAX_MIN_THINK_MS, Math.max(0, Math.round(ms)));
}

/** Milliseconds still to wait so the total think time reaches the minimum. */
export function remainingThinkDelay(elapsedMs: number, minThinkMs: number): number {
  const target = clampMinThinkMs(minThinkMs);
  if (!Number.isFinite(elapsedMs)) return target;
  return Math.max(0, Math.ceil(target - elapsedMs));
}
