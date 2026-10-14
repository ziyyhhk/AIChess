/**
 * A small, original alpha-beta engine used only as an offline fallback.
 *
 * If Stockfish cannot be loaded (no local build and the CDN is unreachable) the
 * analysis view must not invent numbers. Instead it says so and falls back to
 * this engine: a real search over real legal moves with a material +
 * piece-square evaluation, clearly labelled as much weaker than Stockfish.
 *
 * Scores are centipawns from the side-to-move point of view, matching UCI's
 * `score cp` convention, so the analysis maths is identical for both engines.
 */
import { Chess, type Move } from 'chess.js';
import type { Score } from './uci';

export interface MiniSearchResult {
  move: string;
  score: Score;
  depth: number;
  pv: string[];
}

const PIECE_VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

// Piece-square tables from White's point of view, indexed [rank][file] with
// rank 0 = the eighth rank (chess.js draws the board that way).
const PAWN_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5, 5, 10, 25, 25, 10, 5, 5],
  [0, 0, 0, 20, 20, 0, 0, 0],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [5, 10, 10, -20, -20, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0],
];
const KNIGHT_PST = [
  [-50, -40, -30, -30, -30, -30, -40, -50],
  [-40, -20, 0, 0, 0, 0, -20, -40],
  [-30, 0, 10, 15, 15, 10, 0, -30],
  [-30, 5, 15, 20, 20, 15, 5, -30],
  [-30, 0, 15, 20, 20, 15, 0, -30],
  [-30, 5, 10, 15, 15, 10, 5, -30],
  [-40, -20, 0, 5, 5, 0, -20, -40],
  [-50, -40, -30, -30, -30, -30, -40, -50],
];
const BISHOP_PST = [
  [-20, -10, -10, -10, -10, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 5, 10, 10, 5, 0, -10],
  [-10, 5, 5, 10, 10, 5, 5, -10],
  [-10, 0, 10, 10, 10, 10, 0, -10],
  [-10, 10, 10, 10, 10, 10, 10, -10],
  [-10, 5, 0, 0, 0, 0, 5, -10],
  [-20, -10, -10, -10, -10, -10, -10, -20],
];
const ROOK_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [5, 10, 10, 10, 10, 10, 10, 5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [0, 0, 0, 5, 5, 0, 0, 0],
];
const QUEEN_PST = [
  [-20, -10, -10, -5, -5, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 5, 5, 5, 5, 0, -10],
  [-5, 0, 5, 5, 5, 5, 0, -5],
  [0, 0, 5, 5, 5, 5, 0, -5],
  [-10, 5, 5, 5, 5, 5, 0, -10],
  [-10, 0, 5, 0, 0, 0, 0, -10],
  [-20, -10, -10, -5, -5, -10, -10, -20],
];
const KING_PST = [
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-20, -30, -30, -40, -40, -30, -30, -20],
  [-10, -20, -20, -20, -20, -20, -20, -10],
  [20, 20, 0, 0, 0, 0, 20, 20],
  [20, 30, 10, 0, 0, 10, 30, 20],
];

const PST: Record<string, number[][]> = {
  p: PAWN_PST,
  n: KNIGHT_PST,
  b: BISHOP_PST,
  r: ROOK_PST,
  q: QUEEN_PST,
  k: KING_PST,
};

const MATE_SCORE = 100_000 - 1000; // keeps room for "mate in N" ordering

/** Static evaluation in centipawns from the side to move's point of view. */
export function evaluatePosition(chess: Chess): number {
  const board = chess.board();
  let score = 0; // White's point of view
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (!piece) continue;
      const value = PIECE_VALUE[piece.type] ?? 0;
      const table = PST[piece.type] ?? PAWN_PST;
      const positional = piece.color === 'w' ? table[r][f] : table[7 - r][7 - f];
      score += piece.color === 'w' ? value + positional : -(value + positional);
    }
  }
  return chess.turn() === 'w' ? score : -score;
}

interface SearchContext {
  chess: Chess;
  deadline: number;
  nodes: number;
  aborted: boolean;
}

/** Order moves so captures are searched first; quiet moves follow the PST. */
function orderMoves(chess: Chess, moves: Move[]): Move[] {
  const scored = moves.map((move) => {
    let score = 0;
    if (move.captured) score += 1000 + (PIECE_VALUE[move.captured] ?? 0) - (PIECE_VALUE[move.piece] ?? 0) / 10;
    if (move.promotion) score += 800;
    if (move.san.includes('+')) score += 50;
    // Prefer moves that improve the piece's square value.
    const table = PST[move.piece] ?? PAWN_PST;
    const toFile = move.to.charCodeAt(0) - 97;
    const toRank = parseInt(move.to[1], 10) - 1;
    const fromFile = move.from.charCodeAt(0) - 97;
    const fromRank = parseInt(move.from[1], 10) - 1;
    const dir = move.color === 'w' ? 1 : -1;
    score +=
      ((table[8 - toRank - 1]?.[dir === 1 ? toFile : 7 - toFile] ?? 0) -
        (table[8 - fromRank - 1]?.[dir === 1 ? fromFile : 7 - fromFile] ?? 0)) /
      4;
    void chess;
    return { move, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.move);
}

function checkAbort(ctx: SearchContext) {
  ctx.nodes++;
  if (ctx.nodes % 512 === 0 && Date.now() > ctx.deadline) ctx.aborted = true;
}

function quiescence(ctx: SearchContext, alpha: number, beta: number, depth: number): number {
  checkAbort(ctx);
  if (ctx.aborted) return alpha;
  const stand = evaluatePosition(ctx.chess);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  if (depth <= 0) return alpha;

  const captures = ctx.chess
    .moves({ verbose: true })
    .filter((m) => !!m.captured || !!m.promotion);
  for (const move of orderMoves(ctx.chess, captures)) {
    ctx.chess.move(move);
    const score = -quiescence(ctx, -beta, -alpha, depth - 1);
    ctx.chess.undo();
    if (ctx.aborted) return alpha;
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function negamax(
  ctx: SearchContext,
  depth: number,
  alpha: number,
  beta: number,
  ply: number
): number {
  checkAbort(ctx);
  if (ctx.aborted) return alpha;
  if (ctx.chess.isCheckmate()) return -MATE_SCORE + ply;
  if (ctx.chess.isDraw() || ctx.chess.isStalemate()) return 0;
  if (depth <= 0) return quiescence(ctx, alpha, beta, 3);

  const moves = ctx.chess.moves({ verbose: true });
  if (moves.length === 0) return -MATE_SCORE + ply;

  let best = -Infinity;
  let localAlpha = alpha;
  for (const move of orderMoves(ctx.chess, moves)) {
    ctx.chess.move(move);
    const score = -negamax(ctx, depth - 1, -beta, -localAlpha, ply + 1);
    ctx.chess.undo();
    if (ctx.aborted) return best === -Infinity ? localAlpha : best;
    if (score > best) best = score;
    if (score > localAlpha) localAlpha = score;
    if (localAlpha >= beta) break;
  }
  return best;
}

/**
 * Search a position with iterative deepening inside a time budget.
 * Always returns a legal move when the position has one.
 */
export function searchWithMiniEngine(
  fen: string,
  options: { maxDepth?: number; timeBudgetMs?: number } = {}
): MiniSearchResult {
  const maxDepth = Math.max(1, Math.min(4, options.maxDepth ?? 3));
  const timeBudgetMs = Math.max(30, options.timeBudgetMs ?? 150);
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });
  if (legal.length === 0) {
    return { move: '', score: { type: 'cp', value: 0 }, depth: 0, pv: [] };
  }
  const deadline = Date.now() + timeBudgetMs;
  const ctx: SearchContext = { chess, deadline, nodes: 0, aborted: false };

  // Shallow fallback in case the clock runs out immediately.
  let bestMove: Move = orderMoves(chess, legal)[0];
  let bestScore = 0;
  let reachedDepth = 0;

  for (let depth = 1; depth <= maxDepth; depth++) {
    let alpha = -Infinity;
    let depthBest: Move | null = null;
    let depthScore = -Infinity;
    for (const move of orderMoves(chess, chess.moves({ verbose: true }))) {
      chess.move(move);
      const score = -negamax(ctx, depth - 1, -Infinity, -alpha, 1);
      chess.undo();
      if (ctx.aborted) break;
      if (depthBest === null || score > depthScore) {
        depthBest = move;
        depthScore = score;
        if (score > alpha) alpha = score;
      }
    }
    if (depthBest && !ctx.aborted) {
      bestMove = depthBest;
      bestScore = depthScore;
      reachedDepth = depth;
    }
    if (ctx.aborted || reachedDepth >= maxDepth) break;
    if (Math.abs(bestScore) > MATE_SCORE - 2000) break;
    if (Date.now() > deadline) break;
  }

  const isMate = Math.abs(bestScore) > MATE_SCORE - 2000;
  const score: Score = isMate
    ? {
        type: 'mate',
        value: bestScore > 0 ? Math.max(1, Math.ceil((MATE_SCORE - bestScore) / 2)) : -Math.max(1, Math.ceil((MATE_SCORE + bestScore) / 2)),
      }
    : { type: 'cp', value: Math.round(bestScore) };

  return {
    move: bestMove.from + bestMove.to + (bestMove.promotion || ''),
    score,
    depth: reachedDepth,
    pv: [bestMove.from + bestMove.to + (bestMove.promotion || '')],
  };
}
