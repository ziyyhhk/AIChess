/**
 * The analysis run.
 *
 * It walks a *snapshot* of the game history (never the live game), reconstructs
 * every position from the moves, and asks the engine for:
 *
 *   - the evaluation and best line of the position before each move
 *     (searched with MultiPV 2 so the second-best move is known),
 *   - the evaluation of the position after each move.
 *
 * Because the position after ply N is the position before ply N+1, a game of N
 * moves needs only N+1 searches, and consecutive positions are evaluated at the
 * same depth, which is what makes the centipawn losses comparable.
 */
import { Chess, type Move } from 'chess.js';
import type { Evaluator, PositionEvaluation } from './evaluator';
import {
  classifyMove,
  computeAccuracy,
  cpFromPov,
  DEFAULT_THRESHOLDS,
  isMateScore,
  moveAccuracy,
  MATE_CP,
  type ClassificationThresholds,
  type MoveClassification,
} from './classification';
import { isBookPosition } from './openingBook';

export interface AnalysisPlyInput {
  ply: number;
  moveNumber: number;
  side: 'w' | 'b';
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
}

export interface AnalyzedPly extends AnalysisPlyInput {
  /** Engine evaluation of the position after the move, white's point of view. */
  evalCpWhite: number;
  /** The same evaluation seen from the point of view of the side that moved. */
  evalCpMover: number;
  /** Evaluation before the move, white's point of view. */
  evalBeforeCpWhite: number;
  lossCp: number;
  accuracy: number;
  classification: MoveClassification;
  critical: boolean;
  reason: string;
  bestMove: { uci: string; san: string } | null;
  bestLineSan: string[];
  secondBest: { uci: string; san: string; cp: number } | null;
  mateFor: 'w' | 'b' | null;
  mateIn: number | null;
}

export interface AnalysisProgress {
  phase: 'starting' | 'evaluating' | 'finished' | 'cancelled';
  completed: number;
  total: number;
  /** Move number currently being evaluated. */
  moveNumber: number;
  side: 'w' | 'b' | null;
  san: string | null;
  depth: number;
  engineLabel: string;
}

export interface AnalysisSummary {
  players: { white: string; black: string };
  result: string | null;
  counts: Record<MoveClassification, number>;
  criticalCount: number;
  accuracy: { white: number | null; black: number | null };
  accuracySample: { white: number; black: number };
  engineLabel: string;
  engineKind: 'stockfish' | 'builtin';
  depth: number;
  totalMoves: number;
  startedAt: number;
  finishedAt: number;
  aborted: boolean;
  /** Present when Stockfish was unavailable and the fallback engine was used. */
  warning: string | null;
}

export interface GameAnalysis {
  plies: AnalyzedPly[];
  summary: AnalysisSummary;
}

export class AnalysisCancelled extends Error {
  constructor() {
    super('Analysis cancelled');
    this.name = 'AnalysisCancelled';
  }
}

export function toUci(move: Pick<Move, 'from' | 'to' | 'promotion'>): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

/** Snapshot helper: turn the game's verbose history into analysis input. */
export function buildAnalysisPlies(moves: Move[]): AnalysisPlyInput[] {
  return moves.map((move, index) => ({
    ply: index + 1,
    moveNumber: Math.floor(index / 2) + 1,
    side: move.color,
    san: move.san,
    uci: toUci(move),
    fenBefore: move.before,
    fenAfter: move.after,
  }));
}

const PIECE_CP: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

/** SAN for a UCI move in a given position, or null when it is not legal there. */
export function uciToSan(fen: string, uci: string): string | null {
  if (!uci || uci.length < 4) return null;
  try {
    const chess = new Chess(fen);
    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci[4] : undefined,
    });
    return move?.san ?? null;
  } catch {
    return null;
  }
}

/** Convert an engine PV (UCI moves) into SAN for display. */
export function pvToSan(fen: string, pv: string[], limit = 6): string[] {
  const out: string[] = [];
  try {
    const chess = new Chess(fen);
    for (const uci of pv.slice(0, limit)) {
      if (uci.length < 4) break;
      const move = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined,
      });
      if (!move) break;
      out.push(move.san);
    }
  } catch {
    /* partial line is fine */
  }
  return out;
}

/** Material the move offers: value of the moving piece minus what it captured. */
export function sacrificeValueCentiPawns(
  fenAfter: string,
  squareOfMovedPiece: string,
  movedPiece: string,
  capturedPiece: string | undefined
): { canBeCaptured: boolean; sacrificeCp: number } {
  let canBeCaptured = false;
  try {
    const chess = new Chess(fenAfter);
    const moves = chess.moves({ verbose: true });
    canBeCaptured = moves.some((m) => m.to === squareOfMovedPiece && !!m.captured);
  } catch {
    canBeCaptured = false;
  }
  const offered = (PIECE_CP[movedPiece] ?? 0) - (capturedPiece ? PIECE_CP[capturedPiece] ?? 0 : 0);
  return { canBeCaptured, sacrificeCp: Math.max(0, offered) };
}

export interface AnalyzeGameOptions {
  plies: AnalysisPlyInput[];
  evaluator: Evaluator;
  /** Search depth per position. */
  depth: number;
  startFen: string;
  signal: AbortSignal;
  onProgress?: (progress: AnalysisProgress) => void;
  thresholds?: ClassificationThresholds;
  warning?: string | null;
  players?: { white: string; black: string };
  result?: string | null;
}

function emptyCounts(): Record<MoveClassification, number> {
  return {
    brilliant: 0,
    great: 0,
    best: 0,
    excellent: 0,
    good: 0,
    book: 0,
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
    miss: 0,
    forced: 0,
  };
}

export async function analyzeGame(options: AnalyzeGameOptions): Promise<GameAnalysis> {
  const {
    plies,
    evaluator,
    depth,
    signal,
    onProgress,
    thresholds = DEFAULT_THRESHOLDS,
  } = options;
  const startedAt = Date.now();
  const total = plies.length;
  const analyzed: AnalyzedPly[] = [];

  const throwIfCancelled = () => {
    if (signal.aborted) throw new AnalysisCancelled();
  };

  const emit = (progress: Partial<AnalysisProgress>) => {
    onProgress?.({
      phase: 'evaluating',
      completed: analyzed.length,
      total,
      moveNumber: plies[analyzed.length]?.moveNumber ?? 0,
      side: plies[analyzed.length]?.side ?? null,
      san: plies[analyzed.length]?.san ?? null,
      depth,
      engineLabel: evaluator.label,
      ...progress,
    });
  };

  emit({ phase: 'starting', completed: 0 });
  throwIfCancelled();

  // The position before the first move.
  let before: PositionEvaluation = await evaluator.evaluate(options.startFen, {
    depth,
    signal,
    multiPv: 2,
  });

  for (const ply of plies) {
    if (signal.aborted) break;
    let after: PositionEvaluation;
    try {
      after = await evaluator.evaluate(ply.fenAfter, { depth, signal, multiPv: 1 });
    } catch (error) {
      // A cancelled search rejects: keep everything analysed so far instead of
      // throwing the whole run away.
      if (signal.aborted) break;
      throw error;
    }
    if (signal.aborted) break;

    const evalBeforeCpWhite = cpFromPov(before.score, 'w', ply.side);
    const evalAfterCpWhite = cpFromPov(after.score, 'w', ply.side === 'w' ? 'b' : 'w');
    const evalCpMover = evalAfterCpWhite * (ply.side === 'w' ? 1 : -1);

    let legalMoveCount = 0;
    let movedPiece = 'p';
    let capturedPiece: string | undefined;
    try {
      const chessBefore = new Chess(ply.fenBefore);
      legalMoveCount = chessBefore.moves().length;
      const played = chessBefore.move({
        from: ply.uci.slice(0, 2),
        to: ply.uci.slice(2, 4),
        promotion: ply.uci.length > 4 ? ply.uci[4] : undefined,
      });
      movedPiece = played?.piece ?? 'p';
      capturedPiece = played?.captured;
    } catch {
      /* the plies come from the rules engine, this cannot normally happen */
    }

    const sacrifice = sacrificeValueCentiPawns(ply.fenAfter, ply.uci.slice(2, 4), movedPiece, capturedPiece);

    const result = classifyMove(
      {
        moverColor: ply.side,
        cpBeforeWhite: evalBeforeCpWhite,
        cpAfterWhite: evalAfterCpWhite,
        before,
        playedUci: ply.uci,
        legalMoveCount,
        isBookPosition: isBookPosition(ply.fenBefore),
        canBeCaptured: sacrifice.canBeCaptured,
        sacrificeCp: sacrifice.sacrificeCp,
      },
      thresholds
    );

    const bestSan = uciToSan(ply.fenBefore, before.bestMove);
    const secondSan = before.secondBest?.move ? uciToSan(ply.fenBefore, before.secondBest.move) : null;
    const mateFor =
      isMateScore(before.score) && before.score.type === 'mate' && before.score.value > 0
        ? ply.side
        : isMateScore(after.score) && after.score.type === 'mate' && after.score.value > 0
          ? (ply.side === 'w' ? 'b' : 'w')
          : null;
    const mateIn =
      mateFor === ply.side && isMateScore(before.score) && before.score.type === 'mate'
        ? Math.abs(before.score.value)
        : mateFor && isMateScore(after.score) && after.score.type === 'mate'
          ? Math.abs(after.score.value)
          : null;

    analyzed.push({
      ...ply,
      evalCpWhite: evalAfterCpWhite,
      evalCpMover,
      evalBeforeCpWhite,
      lossCp: result.lossCp,
      accuracy: moveAccuracy(result.lossCp),
      classification: result.classification,
      critical: result.critical,
      reason: result.reason,
      bestMove: before.bestMove ? { uci: before.bestMove, san: bestSan ?? before.bestMove } : null,
      bestLineSan: result.playedBest ? pvToSan(ply.fenBefore, before.pv) : pvToSan(ply.fenBefore, [before.bestMove, ...before.pv.slice(1)]),
      secondBest:
        secondSan && before.secondBest
          ? { uci: before.secondBest.move, san: secondSan, cp: before.secondBest.score.value }
          : null,
      mateFor,
      mateIn,
    });

    // The position after this move is the position before the next one: reuse it
    // so both are evaluated at the same depth.
    before = after;
    emit({ completed: analyzed.length });
  }

  const counts = emptyCounts();
  for (const ply of analyzed) counts[ply.classification] += 1;
  const accuracy = computeAccuracy(
    analyzed.map((p) => ({ moverColor: p.side, lossCp: p.lossCp, classification: p.classification }))
  );

  const finishedAt = Date.now();
  const cancelled = signal.aborted;
  onProgress?.({
    phase: cancelled ? 'cancelled' : 'finished',
    completed: analyzed.length,
    total,
    moveNumber: plies[total - 1]?.moveNumber ?? 0,
    side: null,
    san: null,
    depth,
    engineLabel: evaluator.label,
  });

  return {
    plies: analyzed,
    summary: {
      players: options.players ?? { white: 'White', black: 'Black' },
      result: options.result ?? null,
      counts,
      criticalCount: analyzed.filter((p) => p.critical).length,
      accuracy: { white: accuracy.white, black: accuracy.black },
      accuracySample: accuracy.sampleSize,
      engineLabel: evaluator.label,
      engineKind: evaluator.kind,
      depth,
      totalMoves: analyzed.length,
      startedAt,
      finishedAt,
      aborted: cancelled,
      warning: options.warning ?? null,
    },
  };
}

/** Format a white-relative centipawn value the way chess sites do. */
export function formatEvaluation(cp: number): string {
  if (Math.abs(cp) >= MATE_CP - 1000) {
    return cp > 0 ? '+M' : '-M';
  }
  const pawns = cp / 100;
  if (pawns > 0) return `+${pawns.toFixed(2)}`;
  return pawns.toFixed(2);
}
