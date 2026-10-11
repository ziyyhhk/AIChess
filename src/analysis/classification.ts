/**
 * Move classification.
 *
 * These are AIChess's own heuristics, computed from real engine output. They are
 * *not* Chess.com's algorithm (that is proprietary) - the thresholds are in one
 * place below and every label is derived from data:
 *
 *   - the engine's evaluation before the move (searched with MultiPV 2, so the
 *     second-best line is known),
 *   - the engine's evaluation of the position after the move,
 *   - the centipawn loss between the two, in the mover's point of view,
 *   - mate scores, handled separately from ordinary centipawns.
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
  great: 'Great',
  best: 'Best',
  excellent: 'Excellent',
  good: 'Good',
  book: 'Book',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
  miss: 'Miss',
  forced: 'Forced',
};

/** Centipawn value used for a mate score, kept well clear of real evaluations. */
export const MATE_CP = 3000;

export interface ClassificationThresholds {
  /** Loss at or below this counts as "best" even if it is not the engine's move. */
  bestLossCp: number;
  excellentLossCp: number;
  goodLossCp: number;
  inaccuracyLossCp: number;
  mistakeLossCp: number;
  /** A sacrifice must leave the mover at least this well off. */
  brilliantMinCp: number;
  /** MultiPV gap that marks a position as critical. */
  criticalGapCp: number;
  /** Minimum material (centipawns) offered for a sacrifice. */
  brilliantMinSacrificeCp: number;
  /** Position value above which a missed chance counts as a "miss". */
  missWinBeforeCp: number;
  /** ...and the value it must fall to, without actually losing the game. */
  missAfterMaxCp: number;
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
};

export function isMateScore(score: Score | null | undefined): boolean {
  return !!score && score.type === 'mate';
}

/**
 * Convert an engine score to centipawns, from the point of view of the side to
 * move in the search that produced it (UCI's convention). Mate scores are kept
 * far away from ordinary evaluations so they can never be compared as if they
 * were "300 centipawns".
 */
export function scoreToCp(score: Score | null | undefined): number {
  if (!score) return 0;
  if (score.type === 'cp') return score.value;
  // UCI convention: mate 0 means the side to move is already checkmated, which
  // is as bad as it gets - never a positive score.
  if (score.value === 0) return -MATE_CP;
  const n = Math.min(30, Math.abs(score.value));
  const magnitude = MATE_CP - n * 10;
  return score.value > 0 ? magnitude : -magnitude;
}

/** The same score, seen from `pov`'s side of the board. */
export function cpFromPov(score: Score | null | undefined, pov: 'w' | 'b', sideToMove: 'w' | 'b'): number {
  const cp = scoreToCp(score);
  return sideToMove === pov ? cp : -cp;
}

function clampCp(cp: number): number {
  return Math.max(-MATE_CP + 100, Math.min(MATE_CP - 100, cp));
}

export interface ClassifyInput {
  /** The side that played the move. */
  moverColor: 'w' | 'b';
  /** Position value before the move, engine's best line (white point of view). */
  cpBeforeWhite: number;
  /** Position value after the move (white point of view). */
  cpAfterWhite: number;
  /** Evaluation of the position *before* the move, as returned by the engine. */
  before: PositionEvaluation;
  /** Played move in UCI (`e2e4`, `e7e8q`). */
  playedUci: string;
  /** Number of legal moves in the position before the move. */
  legalMoveCount: number;
  /** True when the position is one of the app's small book positions. */
  isBookPosition: boolean;
  /** True when the opponent can capture the piece that just moved. */
  canBeCaptured: boolean;
  /** Material (centipawns) the move gives up, >= 0. */
  sacrificeCp: number;
}

export interface ClassifyResult {
  classification: MoveClassification;
  /** The position hinges on this move (the engine's best line is far ahead of the rest). */
  critical: boolean;
  /** Centipawns lost compared with the engine's choice, in the mover's point of view. */
  lossCp: number;
  /** True when the played move is the engine's first choice. */
  playedBest: boolean;
  reason: string;
}

function sameMove(a: string, b: string): boolean {
  if (!a || !b) return false;
  const normalize = (uci: string) => uci.slice(0, 4).toLowerCase();
  return normalize(a) === normalize(b);
}

/**
 * Grade one move. The order of the checks below *is* the rule set; the tests in
 * `src/__tests__/classification.test.ts` pin it down.
 */
export function classifyMove(
  input: ClassifyInput,
  thresholds: ClassificationThresholds = DEFAULT_THRESHOLDS
): ClassifyResult {
  const { moverColor, before, playedUci } = input;
  const moverSign = moverColor === 'w' ? 1 : -1;
  const cpBeforeMover = input.cpBeforeWhite * moverSign;
  const cpAfterMover = input.cpAfterWhite * moverSign;
  const lossCp = Math.max(0, Math.round(cpBeforeMover - cpAfterMover));
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

  if (
    playedBest &&
    input.sacrificeCp >= thresholds.brilliantMinSacrificeCp &&
    input.canBeCaptured &&
    cpAfterMover >= thresholds.brilliantMinCp
  ) {
    return decide(
      'brilliant',
      `The engine's top choice, offering ${Math.round(input.sacrificeCp / 100)} point(s) of material and still reaching ${formatCp(cpAfterMover)}.`
    );
  }

  if (playedBest && secondGap >= thresholds.criticalGapCp && Math.abs(cpBeforeMover) < MATE_CP - 1000) {
    return decide(
      'great',
      `The engine's top choice, and clearly ahead of the alternative (${formatCp(secondGap)} better).`
    );
  }

  if (playedBest || lossCp <= thresholds.bestLossCp) {
    return decide('best', playedBest ? "Matches the engine's top choice." : 'Keeps the engine evaluation.');
  }

  if (
    cpBeforeMover >= thresholds.missWinBeforeCp &&
    cpAfterMover <= thresholds.missAfterMaxCp &&
    // Still not losing: throwing a win away for a lost position is a blunder.
    cpAfterMover >= -Math.abs(thresholds.missAfterMaxCp)
  ) {
    return decide(
      'miss',
      `A winning position (${formatCp(cpBeforeMover)}) was let slip to ${formatCp(cpAfterMover)}.`
    );
  }

  if (lossCp <= thresholds.excellentLossCp) {
    return decide('excellent', `Loses only ${formatCp(lossCp)} of the engine's evaluation.`);
  }
  if (lossCp <= thresholds.goodLossCp) {
    return decide('good', `A sound move that gives up ${formatCp(lossCp)}.`);
  }
  if (lossCp <= thresholds.inaccuracyLossCp) {
    return decide('inaccuracy', `Gives up ${formatCp(lossCp)}; the engine preferred another move.`);
  }
  if (lossCp <= thresholds.mistakeLossCp) {
    return decide('mistake', `Gives up ${formatCp(lossCp)} of the evaluation.`);
  }
  return decide('blunder', `Gives up ${formatCp(lossCp)}; a major drop in the evaluation.`);
}

export function formatCp(cp: number): string {
  if (Math.abs(cp) >= MATE_CP - 1000) {
    return cp > 0 ? 'a forced mate' : 'a lost position (mate against)';
  }
  const pawns = cp / 100;
  const sign = pawns > 0 ? '+' : '';
  return `${sign}${pawns.toFixed(2)}`;
}

/* ------------------------------------------------------------------ accuracy */

/**
 * Accuracy per move, from the centipawn loss:
 *
 *     accuracy = 100 * exp(-loss / 400)
 *
 * so no loss is 100%, 100cp is about 78%, and a blunder of 500cp is about 29%.
 * A side's accuracy is the average over its own graded moves, book moves and
 * forced moves excluded. This is AIChess's own estimate - the UI says so.
 */
export const ACCURACY_SCALE_CP = 400;

export function moveAccuracy(lossCp: number): number {
  const c = Math.min(lossCp, 4000);
  return 100 * Math.exp(-c / ACCURACY_SCALE_CP);
}

export function computeAccuracy(
  plies: { moverColor: 'w' | 'b'; lossCp: number; classification: MoveClassification }[]
): { white: number | null; black: number | null; sampleSize: { white: number; black: number } } {
  const collect = (color: 'w' | 'b') => {
    const values = plies
      .filter(
        (p) =>
          p.moverColor === color &&
          p.classification !== 'book' &&
          p.classification !== 'forced'
      )
      .map((p) => moveAccuracy(p.lossCp));
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
