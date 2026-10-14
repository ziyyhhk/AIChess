/**
 * Pure geometry + flight planning for piece movement.
 *
 * A "flight" is one piece image travelling across the board. Coordinates are
 * kept in *square units* (0..7) and rendered as `translate(n * 100%)` on an
 * element that is exactly one square wide. That means the animation is correct
 * for any board size, needs no `getBoundingClientRect` measuring, and cannot
 * drift when the board is resized or flipped mid-game.
 */
import type { Square } from 'chess.js';

export type Orientation = 'w' | 'b';

export interface SquarePoint {
  x: number;
  y: number;
}

export interface FlightRequest {
  /** Stable identity of the move that produced this animation. */
  id: string;
  from: Square;
  to: Square;
  color: 'w' | 'b';
  /** Piece type that physically travels. A promoting pawn travels as a pawn. */
  type: string;
  isCastle: boolean;
  /** Where the pointer released a dragged piece, in square units (may be fractional). */
  dropPoint?: SquarePoint;
}

export interface Flight {
  id: string;
  requestId: string;
  color: 'w' | 'b';
  type: string;
  from: Square;
  to: Square;
  start: SquarePoint;
  end: SquarePoint;
  durationMs: number;
  delayMs: number;
  /** True for the piece that was actually moved (as opposed to a castling rook). */
  isPrimary: boolean;
}

export const FILES = 'abcdefgh';

/** Knight-shaped delta, used when drawing arrows. */
export function isKnightDelta(dx: number, dy: number): boolean {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  return (ax === 2 && ay === 1) || (ax === 1 && ay === 2);
}

export function squareToPoint(square: Square, orientation: Orientation): SquarePoint {
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1], 10) - 1;
  return {
    x: orientation === 'w' ? file : 7 - file,
    y: orientation === 'w' ? 7 - rank : rank,
  };
}

export function pointToSquare(point: SquarePoint, orientation: Orientation): Square {
  const x = Math.min(7, Math.max(0, Math.floor(point.x)));
  const y = Math.min(7, Math.max(0, Math.floor(point.y)));
  const file = orientation === 'w' ? x : 7 - x;
  const rank = orientation === 'w' ? 7 - y : y;
  return (String.fromCharCode(97 + file) + (rank + 1)) as Square;
}

/** Pointer position (viewport px) -> square units, given the board's rect. */
export function pointerToPoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  orientation: Orientation
): SquarePoint {
  const col = ((clientX - rect.left) / rect.width) * 8;
  const row = ((clientY - rect.top) / rect.height) * 8;
  // The point describes the centre of the pointer, so shift back by half a square
  // to get the top-left of the dragged piece.
  const px = col - 0.5;
  const py = row - 0.5;
  void orientation;
  return { x: px, y: py };
}

/** Pointer position (viewport px) -> the square it is over. */
export function pointerToSquare(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  orientation: Orientation
): Square {
  const col = Math.floor(((clientX - rect.left) / rect.width) * 8);
  const row = Math.floor(((clientY - rect.top) / rect.height) * 8);
  return pointToSquare({ x: Math.min(7, Math.max(0, col)), y: Math.min(7, Math.max(0, row)) }, orientation);
}

/** Rook squares involved in a castling move. */
export function castleRookSquares(
  to: Square
): { from: Square; to: Square } | null {
  switch (to) {
    case 'g1':
      return { from: 'h1', to: 'f1' };
    case 'c1':
      return { from: 'a1', to: 'd1' };
    case 'g8':
      return { from: 'h8', to: 'f8' };
    case 'c8':
      return { from: 'a8', to: 'd8' };
    default:
      return null;
  }
}

/**
 * Plan the flights for one committed move. Returns an empty array when there is
 * nothing to animate (same square), otherwise the moving piece first and the
 * castling rook second.
 */
export function buildFlights(
  request: FlightRequest,
  orientation: Orientation,
  durationMs: number
): Flight[] {
  if (request.from === request.to) return [];

  const flights: Flight[] = [
    {
      id: `${request.id}:main`,
      requestId: request.id,
      color: request.color,
      type: request.type,
      from: request.from,
      to: request.to,
      start: request.dropPoint ?? squareToPoint(request.from, orientation),
      end: squareToPoint(request.to, orientation),
      durationMs,
      delayMs: 0,
      isPrimary: true,
    },
  ];

  if (request.isCastle) {
    const rook = castleRookSquares(request.to);
    if (rook) {
      flights.push({
        id: `${request.id}:rook`,
        requestId: request.id,
        color: request.color,
        type: 'r',
        from: rook.from,
        to: rook.to,
        start: squareToPoint(rook.from, orientation),
        end: squareToPoint(rook.to, orientation),
        durationMs,
        delayMs: 0,
        isPrimary: false,
      });
    }
  }

  return flights;
}

/** The transform used for one flight frame. */
export function flightTransform(point: SquarePoint): string {
  return `translate3d(${(point.x * 100).toFixed(4)}%, ${(point.y * 100).toFixed(4)}%, 0)`;
}
