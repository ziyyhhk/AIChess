/** Turning a chess.js board or FEN into the flat piece list the board renders. */
import { Chess, type Piece, type Square } from 'chess.js';

export interface BoardPiece {
  type: string;
  color: 'w' | 'b';
  square: Square;
}

const FILES = 'abcdefgh';

export function piecesFromBoard(
  board: (Pick<Piece, 'type' | 'color'> | null | undefined)[][]
): BoardPiece[] {
  const list: BoardPiece[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        list.push({
          type: piece.type,
          color: piece.color,
          square: `${FILES[c]}${8 - r}` as Square,
        });
      }
    }
  }
  return list;
}

/** Piece list for any FEN. Returns an empty list if the FEN is unusable. */
export function piecesFromFen(fen: string): BoardPiece[] {
  try {
    return piecesFromBoard(new Chess(fen).board());
  } catch {
    return [];
  }
}

/** The king's square when that side is in check, else null. */
export function kingInCheckSquare(fen: string): Square | null {
  try {
    const chess = new Chess(fen);
    if (!chess.isCheck()) return null;
    const color = chess.turn();
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === 'k' && piece.color === color) {
          return `${FILES[c]}${8 - r}` as Square;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Last move of a FEN's history, when the FEN carries none this is null. */
export function lastMoveFromFen(): null {
  return null;
}
