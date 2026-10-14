export const DEFAULT_PLAYER_RATING = 1000;
export const K_FACTOR = 24;

export interface AttemptRecord {
  puzzleId: string;
  puzzleRating: number;
  solved: boolean;
  incorrectAttempts: number;
  hintsUsed: number;
  at: string;
}

export interface PlayerPuzzleStats {
  rating: number;
  solved: number;
  failed: number;
  attempts: number;
  streak: number;
  bestStreak: number;
  hintsUsed: number;
  history: AttemptRecord[];
}

export const EMPTY_STATS: PlayerPuzzleStats = {
  rating: DEFAULT_PLAYER_RATING,
  solved: 0,
  failed: 0,
  attempts: 0,
  streak: 0,
  bestStreak: 0,
  hintsUsed: 0,
  history: [],
};

function expectedScore(player: number, puzzle: number): number {
  return 1 / (1 + 10 ** ((puzzle - player) / 400));
}

export function performanceScore(opts: {
  solved: boolean;
  incorrectAttempts: number;
  hintsUsed: number;
}): number {
  if (!opts.solved) return 0;
  let s = 1;
  s -= Math.min(0.45, opts.incorrectAttempts * 0.12);
  s -= Math.min(0.35, opts.hintsUsed * 0.12);
  return Math.max(0.15, s);
}

export function updateRating(
  stats: PlayerPuzzleStats,
  puzzleRating: number,
  score: number
): number {
  const exp = expectedScore(stats.rating, puzzleRating);
  return Math.round(stats.rating + K_FACTOR * (score - exp));
}

export function applyAttempt(
  stats: PlayerPuzzleStats,
  attempt: Omit<AttemptRecord, 'at'> & { at?: string }
): PlayerPuzzleStats {
  const score = performanceScore(attempt);
  const rating = updateRating(stats, attempt.puzzleRating, score);
  const solved = attempt.solved ? stats.solved + 1 : stats.solved;
  const failed = attempt.solved ? stats.failed : stats.failed + 1;
  const streak = attempt.solved ? stats.streak + 1 : 0;
  const record: AttemptRecord = {
    puzzleId: attempt.puzzleId,
    puzzleRating: attempt.puzzleRating,
    solved: attempt.solved,
    incorrectAttempts: attempt.incorrectAttempts,
    hintsUsed: attempt.hintsUsed,
    at: attempt.at ?? new Date().toISOString(),
  };
  return {
    rating,
    solved,
    failed,
    attempts: stats.attempts + 1,
    streak,
    bestStreak: Math.max(stats.bestStreak, streak),
    hintsUsed: stats.hintsUsed + attempt.hintsUsed,
    history: [record, ...stats.history].slice(0, 100),
  };
}

const STORAGE_KEY = 'aichess-puzzle-stats';

export function loadPuzzleStats(): PlayerPuzzleStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_STATS };
    const parsed = JSON.parse(raw) as Partial<PlayerPuzzleStats>;
    return { ...EMPTY_STATS, ...parsed, history: parsed.history ?? [] };
  } catch {
    return { ...EMPTY_STATS };
  }
}

export function savePuzzleStats(stats: PlayerPuzzleStats): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    /* ignore */
  }
}
