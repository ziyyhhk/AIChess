import { describe, it, expect } from 'vitest';
import {
  buildFlights,
  castleRookSquares,
  flightTransform,
  isKnightDelta,
  pointToSquare,
  pointerToPoint,
  pointerToSquare,
  squareToPoint,
  type FlightRequest,
} from '../components/board/flights';

const pawnPush: FlightRequest = {
  id: 'a|e2e4#1',
  from: 'e2',
  to: 'e4',
  color: 'w',
  type: 'p',
  isCastle: false,
};

describe('board geometry', () => {
  it('places e2 and e4 for White at the bottom of the board', () => {
    expect(squareToPoint('e2', 'w')).toEqual({ x: 4, y: 6 });
    expect(squareToPoint('e4', 'w')).toEqual({ x: 4, y: 4 });
    expect(squareToPoint('a8', 'w')).toEqual({ x: 0, y: 0 });
  });

  it('mirrors the coordinates when the board is flipped', () => {
    expect(squareToPoint('e2', 'b')).toEqual({ x: 3, y: 1 });
    expect(squareToPoint('e4', 'b')).toEqual({ x: 3, y: 3 });
    expect(pointToSquare(squareToPoint('h1', 'b'), 'b')).toBe('h1');
  });

  it('round-trips every square in both orientations', () => {
    const squares = ['a1', 'h8', 'e4', 'c6', 'd2', 'f7'] as const;
    for (const square of squares) {
      for (const orientation of ['w', 'b'] as const) {
        expect(pointToSquare(squareToPoint(square, orientation), orientation)).toBe(square);
      }
    }
  });

  it('maps a pointer position to the square under it', () => {
    const rect = { left: 0, top: 0, width: 800, height: 800 };
    // Centre of the e4 square for White: file e (4), rank 4 (row 4).
    expect(pointerToSquare(4 * 100 + 50, 4 * 100 + 50, rect, 'w')).toBe('e4');
    // Corners of the board.
    expect(pointerToSquare(799, 799, rect, 'w')).toBe('h1');
    expect(pointerToSquare(0, 0, rect, 'w')).toBe('a8');
    expect(pointerToSquare(799, 799, rect, 'b')).toBe('a8');
  });

  it('returns the top-left of a dragged piece from a pointer position', () => {
    const rect = { left: 100, top: 50, width: 800, height: 800 };
    const point = pointerToPoint(100 + 4 * 100 + 50, 50 + 4 * 100 + 50, rect, 'w');
    expect(point).toEqual({ x: 4, y: 4 });
  });
});

describe('flight planning', () => {
  it('animates a pawn from its source square to its destination', () => {
    const flights = buildFlights(pawnPush, 'w', 200);
    expect(flights).toHaveLength(1);
    expect(flights[0].start).toEqual({ x: 4, y: 6 });
    expect(flights[0].end).toEqual({ x: 4, y: 4 });
    expect(flights[0].type).toBe('p');
    expect(flights[0].isPrimary).toBe(true);
  });

  it('animates a knight the same way', () => {
    const flights = buildFlights(
      { id: 'b|g1f3#2', from: 'g1', to: 'f3', color: 'w', type: 'n', isCastle: false },
      'w',
      200
    );
    expect(flights[0].start).toEqual({ x: 6, y: 7 });
    expect(flights[0].end).toEqual({ x: 5, y: 5 });
    expect(flights[0].type).toBe('n');
  });

  it('starts from where a dragged piece was released', () => {
    const flights = buildFlights({ ...pawnPush, dropPoint: { x: 4.2, y: 3.1 } }, 'w', 200);
    expect(flights[0].start).toEqual({ x: 4.2, y: 3.1 });
    expect(flights[0].end).toEqual({ x: 4, y: 4 });
  });

  it('keeps the pawn as the travelling piece for a promotion', () => {
    const flights = buildFlights(
      { id: 'c|e7e8#3', from: 'e7', to: 'e8', color: 'w', type: 'p', isCastle: false },
      'w',
      200
    );
    expect(flights[0].type).toBe('p');
  });

  it('moves both pieces when castling', () => {
    const flights = buildFlights(
      { id: 'd|e1g1#4', from: 'e1', to: 'g1', color: 'w', type: 'k', isCastle: true },
      'w',
      200
    );
    expect(flights).toHaveLength(2);
    const rook = flights.find((f) => f.type === 'r')!;
    expect(rook.from).toBe('h1');
    expect(rook.to).toBe('f1');
    expect(rook.start).toEqual({ x: 7, y: 7 });
    expect(rook.end).toEqual({ x: 5, y: 7 });
  });

  it('handles queenside castling for both colours', () => {
    expect(castleRookSquares('c1')).toEqual({ from: 'a1', to: 'd1' });
    expect(castleRookSquares('c8')).toEqual({ from: 'a8', to: 'd8' });
    expect(castleRookSquares('e4')).toBeNull();
  });

  it('ignores a move that goes nowhere', () => {
    expect(buildFlights({ ...pawnPush, to: 'e2' }, 'w', 200)).toEqual([]);
  });

  it('produces the transform that moves the piece one square per 100%', () => {
    expect(flightTransform({ x: 4, y: 6 })).toBe('translate3d(400.0000%, 600.0000%, 0)');
    const flights = buildFlights(pawnPush, 'w', 200);
    expect(flightTransform(flights[0].start)).not.toBe(flightTransform(flights[0].end));
  });

  it('produces the same relative travel when the board is flipped', () => {
    const upright = buildFlights(pawnPush, 'w', 200)[0];
    const flipped = buildFlights(pawnPush, 'b', 200)[0];
    expect(flipped.start.y - flipped.end.y).toBe(upright.end.y - upright.start.y);
    expect(flipped.start.x).toBe(upright.start.x === 4 ? 3 : flipped.start.x);
  });
});

describe('knight arrows', () => {
  it('detects knight-shaped moves', () => {
    expect(isKnightDelta(2, 1)).toBe(true);
    expect(isKnightDelta(-1, 2)).toBe(true);
    expect(isKnightDelta(1, 1)).toBe(false);
    expect(isKnightDelta(0, 3)).toBe(false);
  });
});
