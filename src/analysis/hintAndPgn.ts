/** Live-game hint + history PGN analysis helpers used by App. */
import type { Square } from 'chess.js';
import { Chess } from 'chess.js';
import { analyzeGame, buildAnalysisPlies, type GameAnalysis } from './analyzeGame';
import { createEvaluator } from './evaluator';
import { EvaluatorPool } from './workerPool';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export async function analyzePgnString(
  pgn: string,
  depth: number,
  signal: AbortSignal,
  onProgress: (p: unknown) => void,
  players?: { white: string; black: string }
): Promise<{
  analysis: GameAnalysis | null;
  warning: string | null;
  players: { white: string; black: string };
  error?: string;
}> {
  let verbose: import('chess.js').Move[] = [];
  let resultToken: string | null = '*';
  let names = players || { white: 'White', black: 'Black' };
  try {
    const c = new Chess();
    c.loadPgn(pgn);
    verbose = c.history({ verbose: true });
    const header = c.header();
    resultToken =
      header.Result ||
      (c.isGameOver()
        ? c.isCheckmate()
          ? c.turn() === 'w'
            ? '0-1'
            : '1-0'
          : '1/2-1/2'
        : '*');
    if (!players) {
      names = { white: header.White || 'White', black: header.Black || 'Black' };
    }
  } catch (e) {
    return {
      analysis: null,
      warning: null,
      players: names,
      error: e instanceof Error ? e.message : 'Could not parse that PGN.',
    };
  }
  if (verbose.length === 0) {
    return {
      analysis: null,
      warning: null,
      players: names,
      error: 'That PGN has no moves to analyse.',
    };
  }
  const plies = buildAnalysisPlies(verbose);
  const pool = await EvaluatorPool.create();
  const { evaluator, warning } = await createEvaluator();
  try {
    const warn = warning ?? pool.warning ?? null;
    const analysis = await analyzeGame({
      plies,
      evaluator,
      pool,
      depth,
      startFen: START_FEN,
      signal,
      warning: warn,
      players: names,
      result: resultToken,
      onProgress: onProgress as any,
    });
    return { analysis, warning: warn, players: names };
  } finally {
    evaluator.dispose();
    pool.dispose();
  }
}

export type HintLevel = 1 | 2 | 3;

export async function computeHint(
  fen: string,
  depth: number,
  level: HintLevel,
  signal: AbortSignal
): Promise<{ status: string; arrow: { from: Square; to: Square } | null }> {
  const { evaluator, warning } = await createEvaluator();
  try {
    const evaluation = await evaluator.evaluate(fen, {
      depth: Math.min(14, depth || 12),
      signal,
      multiPv: 1,
    });
    const best = evaluation.bestMove;
    if (!best || best.length < 4) {
      return { status: 'The engine did not return a move for this position.', arrow: null };
    }
    const from = best.slice(0, 2) as Square;
    const to = best.slice(2, 4) as Square;
    let status: string;
    let arrow: { from: Square; to: Square } | null = null;
    if (level === 1) {
      status = 'Look for a forcing idea — a check, capture, or improving a piece.';
    } else if (level === 2) {
      status = `Consider the piece on ${from}.`;
    } else {
      status = `Suggested: ${from} → ${to}. The engine recommends this continuation.`;
      arrow = { from, to };
    }
    if (warning) status = `${status} (${warning})`;
    return { status, arrow };
  } finally {
    evaluator.dispose();
  }
}
