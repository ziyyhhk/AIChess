import { Chess } from 'chess.js';
import type { PuzzleDef, PuzzleLineStep } from './catalog';

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

function applyUci(chess: Chess, uci: string): boolean {
  if (uci.length < 4) return false;
  try {
    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? (uci[4] as 'q' | 'r' | 'b' | 'n') : undefined,
    });
    return !!move;
  } catch {
    return false;
  }
}

export function validatePuzzle(puzzle: PuzzleDef): ValidationResult {
  let chess: Chess;
  try {
    chess = new Chess(puzzle.fen);
  } catch {
    return { ok: false, reason: 'Illegal starting FEN' };
  }
  if (chess.turn() !== puzzle.sideToMove) {
    return { ok: false, reason: 'Side to move does not match FEN' };
  }
  if (!puzzle.solution.length) {
    return { ok: false, reason: 'No solution line' };
  }

  for (let i = 0; i < puzzle.solution.length; i++) {
    const step = puzzle.solution[i];
    if (!applyUci(chess, step.uci)) {
      return { ok: false, reason: `Illegal solver move at step ${i + 1}: ${step.uci}` };
    }
    if (step.replyUci) {
      if (chess.isGameOver()) {
        return { ok: false, reason: `Game already over before reply at step ${i + 1}` };
      }
      if (!applyUci(chess, step.replyUci)) {
        return { ok: false, reason: `Illegal reply at step ${i + 1}: ${step.replyUci}` };
      }
    }
  }

  if (puzzle.theme === 'mateIn1' || puzzle.objective.includes('one move')) {
    if (!chess.isCheckmate()) {
      return { ok: false, reason: 'Mate-in-1 solution does not deliver checkmate' };
    }
  }
  if (puzzle.theme === 'mateIn2' || puzzle.objective.includes('two moves')) {
    if (!chess.isCheckmate()) {
      return { ok: false, reason: 'Mate-in-2 line does not end in checkmate' };
    }
  }

  return { ok: true };
}

export function filterValidPuzzles(list: PuzzleDef[]): PuzzleDef[] {
  return list.filter((p) => validatePuzzle(p).ok);
}

export function isAcceptedMove(puzzle: PuzzleDef, stepIndex: number, uci: string): boolean {
  const step = puzzle.solution[stepIndex];
  if (!step) return false;
  if (uci === step.uci) return true;
  if (stepIndex === 0 && puzzle.altFirstMoves?.includes(uci)) return true;
  return false;
}

export function applySolutionStep(
  fen: string,
  step: PuzzleLineStep
): { fen: string; ok: boolean } {
  try {
    const chess = new Chess(fen);
    if (!applyUci(chess, step.uci)) return { fen, ok: false };
    if (step.replyUci && !chess.isGameOver()) {
      if (!applyUci(chess, step.replyUci)) return { fen: chess.fen(), ok: false };
    }
    return { fen: chess.fen(), ok: true };
  } catch {
    return { fen, ok: false };
  }
}
