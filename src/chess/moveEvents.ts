/**
 * Turns a chess move that has just been committed into the facts the rest of
 * the app needs: which sound to play, and what to animate.
 *
 * Everything here is derived from the move object returned by the rules engine
 * plus the position *after* the move. Nothing is inferred from which square was
 * clicked or which piece the user had selected - that is what made the old
 * implementation unreliable.
 */
import type { Move } from 'chess.js';
import type { MoveSoundEvent } from '../audio/soundCatalog';

export type MoveActor = 'player' | 'opponent';

export interface MoveFacts {
  /** `c` capture, `e` en passant, `k`/`q` castling side, `p` promotion */
  flags: string;
  isCapture: boolean;
  isEnPassant: boolean;
  isCastle: boolean;
  isPromotion: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  /** Piece that moved, and the piece it captured (if any). */
  piece: string;
  captured?: string;
  from: string;
  to: string;
  promotion?: string;
}

/** Facts about the move itself, independent of the position afterwards. */
export function moveFacts(move: Move): MoveFacts {
  const flags = move.flags || '';
  return {
    flags,
    isCapture: flags.includes('c') || flags.includes('e'),
    isEnPassant: flags.includes('e'),
    isCastle: flags.includes('k') || flags.includes('q'),
    isPromotion: flags.includes('p') || !!move.promotion,
    isCheck: false,
    isCheckmate: false,
    isDraw: false,
    piece: move.piece,
    captured: move.captured,
    from: move.from,
    to: move.to,
    promotion: move.promotion ?? undefined,
  };
}

/**
 * A stable identity for one committed move: the position it was played in plus
 * the move itself. Used to drop duplicate sound events coming from React
 * re-renders, StrictMode double-invocations, or two components noticing the
 * same move.
 */
export function moveKey(fenBefore: string, move: Move): string {
  return `${fenBefore}|${move.from}${move.to}${move.promotion || ''}`;
}

/** Sound event for a committed move. `position` must be the state after it. */
export function moveSoundEvent(options: {
  actor: MoveActor;
  move: Move;
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  playerWon?: boolean;
}): MoveSoundEvent {
  const facts = moveFacts(options.move);
  return {
    actor: options.actor,
    isCapture: facts.isCapture,
    isCastle: facts.isCastle,
    isPromotion: facts.isPromotion,
    isCheck: options.isCheck && !options.isCheckmate,
    isCheckmate: options.isCheckmate,
    isDraw: options.isDraw,
    playerWon: options.playerWon,
  };
}
