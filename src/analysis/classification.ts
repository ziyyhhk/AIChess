/**
 * Move classification.
 *
 * AIChess heuristics from real engine output (not any other product's algorithm).
 * Grades use win-percentage drop where specified; thresholds live in one config.
 */
import type { Score } from '../engine/uci';
import type { PositionEvaluation } from './evaluator';

export type MoveClassification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'miss'
  | 'forced';

export const CLASSIFICATIONS: MoveClassification[] = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'inaccuracy',
  'mistake',
  'blunder',
  'miss',
  'forced',
];

/** Labels used in the UI (single source of truth, no emoji). */
export const CLASSIFICATION_LABEL: Record<MoveClassification, string> = {
  brilliant: 'Brilliant',
  great: 'Very good',
  best: 'Best',
  excellent: 'Excellent',
  good: 'Good',
  book: 'Theoretical',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
  miss: 'Miss',
  forced: 'Forced',
};

export const MATE_CP = 3000;

/**
 * Win-percentage conversion.
 * win% = 50 + 50 * (2 / (1 + e^(-k*cp)) - 1)
 * k starts at 0.00368 (common logistic scale for chess engines).
 * Tune only if validation improves agreement; record any change.
 */
export const WIN_PCT_K = 0.00368;

export function cpToWinPct(cp: number): number {
  const clamped = Math.max(-MATE_CP + 100, Math.min(MATE_CP - 100, cp));
  const logistic = 2 / (1 + Math.exp(-WIN_PCT_K * clamped)) - 1;
  return 50 + 50 * logistic;
}

export function winPctLoss(cpBeforeMover: number, cpAfterMover: number): number {
  const before = cpToWinPct(cpBeforeMover);
  const after = cpToWinPct(cpAfterMover);
  return Math.max(0, before - after);
}

export interface ClassificationThresholds {
  bestLossCp: number;
  excellentLossCp: number;
  goodLossCp: number;
  inaccuracyLossCp: number;
  mistakeLossCp: number;
  brilliantMinCp: number;
  criticalGapCp: number;
  brilliantMinSacrificeCp: number;
  missWinBeforeCp: number;
  missAfterMaxCp: number;
  /** Win% drop thresholds (used for accuracy curve). */
  bestLossWinPct: number;
  excellentLossWinPct: number;
  goodLossWinPct: number;
  inaccuracyLossWinPct: number;
  mistakeLossWinPct: number;
}

export const DEFAULT_THRESHOLDS: ClassificationThresholds = {
  bestLossCp: 12,
  excellentLossCp: 35,
  goodLossCp: 80,
  inaccuracyLossCp: 160,
  mistakeLossCp: 320,
  brilliantMinCp: 100,
  criticalGapCp: 150,
  brilliantMinSacrificeCp: 100,
  missWinBeforeCp: 200,
  missAfterMaxCp: 80,
  bestLossWinPct: 1.5,
  excellentLossWinPct: 4,
  goodLossWinPct: 8,
  inaccuracyLossWinPct: 15,
  mistakeLossWinPct: 25,
};

export function isMateScore(score: Score | null | undefined): boolean {
  return !!score && score.type === 'mate';
}

export function scoreToCp(score: Score | null | undefined): number {
  if (!score) return 0;
  if (score.type === 'cp') return score.value;
  if (score.value === 0) return -MATE_CP;
  const n = Math.min(30, Math.abs(score.value));
  const magnitude = MATE_CP - n * 10;
  return score.value > 0 ? magnitude : -magnitude;
}

export function cpFromPov(score: Score | null | undefined, pov: 'w' | 'b', sideToMove: 'w' | 'b'): number {
  const cp = scoreToCp(score);
  return sideToMove === pov ? cp : -cp;
}

function clampCp(cp: number): number {
  return Math.max(-MATE_CP + 100, Math.min(MATE_CP - 100, cp));
}

export interface ClassifyInput {
  moverColor: 'w' | 'b';
  cpBeforeWhite: number;
  cpAfterWhite: number;
  before: PositionEvaluation;
  playedUci: string;
  legalMoveCount: number;
  isBookPosition: boolean;
  canBeCaptured: boolean;
  sacrificeCp: number;
}

export interface ClassifyResult {
  classification: MoveClassification;
  critical: boolean;
  lossCp: number;
  lossWinPct: number;
  playedBest: boolean;
  reason: string;
}

function sameMove(a: string, b: string): boolean {
  if (!a || !b) return false;
  const normalize = (uci: string) => uci.slice(0, 4).toLowerCase();
  return normalize(a) === normalize(b);
}

export function classifyMove(
  input: ClassifyInput,
  thresholds: ClassificationThresholds = DEFAULT_THRESHOLDS
): ClassifyResult {
  const { moverColor, before, playedUci } = input;
  const moverSign = moverColor === 'w' ? 1 : -1;
  const cpBeforeMover = input.cpBeforeWhite * moverSign;
  const cpAfterMover = input.cpAfterWhite * moverSign;
  const lossCp = Math.max(0, Math.round(cpBeforeMover - cpAfterMover));
  const lossWinPct = winPctLoss(cpBeforeMover, cpAfterMover);
  const playedBest = sameMove(playedUci, before.bestMove);
  const secondGap =
    before.secondBest && before.secondBest.move !== before.bestMove
      ? Math.abs(scoreToCp(before.score) - scoreToCp(before.secondBest.score))
      : 0;
  const critical = secondGap >= thresholds.criticalGapCp;

  const decide = (classification: MoveClassification, reason: string): ClassifyResult => ({
    classification,
    critical,
    lossCp,
    lossWinPct,
    playedBest,
    reason,
  });

  if (input.legalMoveCount <= 1) {
    return decide('forced', 'The only legal move in the position.');
  }

  if (input.isBookPosition && playedBest) {
    return decide('book', 'A known opening move, and the engine agrees with it.');
  }

  const hadMate = isMateScore(before.score) && before.score.type === 'mate' && before.score.value > 0;
  const mateLost = hadMate && cpAfterMover < MATE_CP - 1000;

  if (mateLost) {
    if (cpAfterMover >= 0) {
      return decide('miss', 'A forced mate was available and was not taken, though the game is still fine.');
    }
    return decide('blunder', 'A forced mate was available and was not taken; the game has now turned around.');
  }

  // Brilliant: engine best, intentional material offer, win% still above 50
  if (
    playedBest &&
    input.sacrificeCp >= thresholds.brilliantMinSacrificeCp &&
    input.canBeCaptured &&
    cpToWinPct(cpAfterMover) > 50
  ) {
    return decide(
      'brilliant',
      `The engine's top choice, offering material and still keeping a winning chance (${cpToWinPct(cpAfterMover).toFixed(0)}%).`
    );
  }

  // Great / Very good: engine best with clear MultiPV gap
  if (playedBest && secondGap >= thresholds.criticalGapCp && Math.abs(cpBeforeMover) < MATE_CP - 1000) {
    return decide(
      'great',
      `The engine's top choice, clearly ahead of the alternative (${formatCp(secondGap)} better).`
    );
  }

  if (playedBest || lossCp <= thresholds.bestLossCp || lossWinPct <= thresholds.bestLossWinPct) {
    return decide('best', playedBest ? "Matches the engine's top choice." : 'Keeps the engine evaluation.');
  }

  if (
    cpBeforeMover >= thresholds.missWinBeforeCp &&
    cpAfterMover <= thresholds.missAfterMaxCp &&
    cpAfterMover >= -Math.abs(thresholds.missAfterMaxCp)
  ) {
    return decide(
      'miss',
      `A winning position (${formatCp(cpBeforeMover)}) was let slip to ${formatCp(cpAfterMover)}.`
    );
  }

  if (lossWinPct <= thresholds.excellentLossWinPct || lossCp <= thresholds.excellentLossCp) {
    return decide('excellent', `Small evaluation drop (${lossWinPct.toFixed(1)}% win chance).`);
  }
  if (lossWinPct <= thresholds.goodLossWinPct || lossCp <= thresholds.goodLossCp) {
    return decide('good', `A sound move (${lossWinPct.toFixed(1)}% win-chance drop).`);
  }
  if (lossWinPct <= thresholds.inaccuracyLossWinPct || lossCp <= thresholds.inaccuracyLossCp) {
    return decide('inaccuracy', `Gives up ${lossWinPct.toFixed(1)}% win chance; the engine preferred another move.`);
  }
  if (lossWinPct <= thresholds.mistakeLossWinPct || lossCp <= thresholds.mistakeLossCp) {
    return decide('mistake', `Gives up ${lossWinPct.toFixed(1)}% win chance.`);
  }
  return decide('blunder', `Major drop (${lossWinPct.toFixed(1)}% win chance).`);
}

export function formatCp(cp: number): string {
  if (Math.abs(cp) >= MATE_CP - 1000) {
    return cp > 0 ? 'a forced mate' : 'a lost position (mate against)';
  }
  const pawns = cp / 100;
  const sign = pawns > 0 ? '+' : '';
  return `${sign}${pawns.toFixed(2)}`;
}

/**
 * Per-move accuracy from win-percentage loss:
 *   accuracy = 100 * exp(-lossWinPct / 12)
 * Book and forced moves are excluded from side averages.
 * Labelled "AIChess estimate" in the UI.
 */
export const ACCURACY_SCALE_WIN_PCT = 12;

export function moveAccuracyFromWinPct(lossWinPct: number): number {
  const c = Math.min(lossWinPct, 80);
  return 100 * Math.exp(-c / ACCURACY_SCALE_WIN_PCT);
}

/** Legacy cp-based curve kept for tests; prefer moveAccuracyFromWinPct. */
export const ACCURACY_SCALE_CP = 400;

export function moveAccuracy(lossCp: number): number {
  const c = Math.min(lossCp, 4000);
  return 100 * Math.exp(-c / ACCURACY_SCALE_CP);
}

export function computeAccuracy(
  plies: {
    moverColor: 'w' | 'b';
    lossCp: number;
    lossWinPct?: number;
    classification: MoveClassification;
  }[]
): { white: number | null; black: number | null; sampleSize: { white: number; black: number } } {
  const collect = (color: 'w' | 'b') => {
    const values = plies
      .filter(
        (p) =>
          p.moverColor === color &&
          p.classification !== 'book' &&
          p.classification !== 'forced'
      )
      .map((p) =>
        p.lossWinPct != null
          ? moveAccuracyFromWinPct(p.lossWinPct)
          : moveAccuracy(p.lossCp)
      );
    if (!values.length) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  };
  const white = collect('w');
  const black = collect('b');
  return {
    white,
    black,
    sampleSize: {
      white: plies.filter((p) => p.moverColor === 'w' && p.classification !== 'book' && p.classification !== 'forced').length,
      black: plies.filter((p) => p.moverColor === 'b' && p.classification !== 'book' && p.classification !== 'forced').length,
    },
  };
}

export { clampCp };
