/**
 * What a click or a drop on the board means.
 *
 * Kept as a pure function so the selection rules - the ones that used to play a
 * false "illegal move" sound when switching between two of your own pieces - are
 * pinned down by tests instead of living inside a component.
 *
 * Nothing here plays a sound or touches the game; it only decides intent.
 */
import type { Square } from 'chess.js';
import type { Premove } from './premoveManager';

export type SquareClickIntent =
  | { kind: 'ignore' }
  | { kind: 'select'; square: Square }
  | { kind: 'deselect' }
  | { kind: 'move'; from: Square; to: Square }
  | { kind: 'promote'; from: Square; to: Square }
  | { kind: 'premove'; from: Square; to: Square }
  | { kind: 'illegal' };

export interface SidePiece {
  color: 'w' | 'b';
}

export interface ClickContext {
  selected: Square | null;
  clicked: Square;
  /** The piece standing on the clicked square, if any. */
  clickedPiece: SidePiece | null;
  playerColor: 'w' | 'b';
  isPlayerTurn: boolean;
  premovesEnabled: boolean;
  gameOver: boolean;
  /** Legal destinations for the currently selected piece. */
  legalTargets: readonly Square[];
  /** Destinations that require the player to choose a promotion piece. */
  promotionTargets: readonly Square[];
}

/** A click on a square. */
export function resolveSquareClick(ctx: ClickContext): SquareClickIntent {
  if (ctx.gameOver) return { kind: 'ignore' };
  const owns = (piece: SidePiece | null) => !!piece && piece.color === ctx.playerColor;

  if (!ctx.isPlayerTurn) {
    if (!ctx.premovesEnabled) return { kind: 'ignore' };
    if (ctx.selected) {
      if (owns(ctx.clickedPiece)) {
        // Switching between your own pieces while the opponent moves.
        return ctx.selected === ctx.clicked ? { kind: 'deselect' } : { kind: 'select', square: ctx.clicked };
      }
      return { kind: 'premove', from: ctx.selected, to: ctx.clicked };
    }
    return owns(ctx.clickedPiece) ? { kind: 'select', square: ctx.clicked } : { kind: 'ignore' };
  }

  if (!ctx.selected) {
    return owns(ctx.clickedPiece) ? { kind: 'select', square: ctx.clicked } : { kind: 'ignore' };
  }
  if (ctx.selected === ctx.clicked) return { kind: 'deselect' };
  if (owns(ctx.clickedPiece)) return { kind: 'select', square: ctx.clicked };
  if (ctx.legalTargets.includes(ctx.clicked)) {
    return ctx.promotionTargets.includes(ctx.clicked)
      ? { kind: 'promote', from: ctx.selected, to: ctx.clicked }
      : { kind: 'move', from: ctx.selected, to: ctx.clicked };
  }
  // A move attempt that the rules engine will reject.
  return { kind: 'illegal' };
}

export interface DropContext {
  from: Square;
  to: Square;
  pieceAtFrom: SidePiece | null;
  pieceAtTo: SidePiece | null;
  playerColor: 'w' | 'b';
  isPlayerTurn: boolean;
  premovesEnabled: boolean;
  gameOver: boolean;
  legalTargets: readonly Square[];
  promotionTargets: readonly Square[];
}

/** A dragged piece released on a square. */
export function resolveDropIntent(ctx: DropContext): SquareClickIntent {
  if (ctx.gameOver || ctx.from === ctx.to) return { kind: 'ignore' };
  const owns = (piece: SidePiece | null) => !!piece && piece.color === ctx.playerColor;

  if (!owns(ctx.pieceAtFrom)) return { kind: 'ignore' };

  if (!ctx.isPlayerTurn) {
    if (!ctx.premovesEnabled) return { kind: 'ignore' };
    if (owns(ctx.pieceAtTo)) return { kind: 'select', square: ctx.to };
    return { kind: 'premove', from: ctx.from, to: ctx.to };
  }

  if (owns(ctx.pieceAtTo)) return { kind: 'select', square: ctx.to };
  if (ctx.legalTargets.includes(ctx.to)) {
    return ctx.promotionTargets.includes(ctx.to)
      ? { kind: 'promote', from: ctx.from, to: ctx.to }
      : { kind: 'move', from: ctx.from, to: ctx.to };
  }
  return { kind: 'illegal' };
}

/** The premove a click intent should queue, if any. */
export function premoveFromIntent(intent: SquareClickIntent): Premove | null {
  return intent.kind === 'premove' ? { from: intent.from, to: intent.to } : null;
}
