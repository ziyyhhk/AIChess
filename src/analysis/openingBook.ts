/**
 * A deliberately small opening book.
 *
 * `Book` is only ever assigned when the played move is one of these known
 * opening lines *and* it matches the engine's top choice, so the label never
 * pretends to be a full database. Anything outside this list is graded by the
 * engine like every other move.
 */
import { Chess } from 'chess.js';

/** Opening lines in SAN. Each entry is one complete line from the start. */
const LINES: string[][] = [
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'], // Ruy Lopez
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], // Italian
  ['e4', 'e5', 'Nf3', 'Nc6', 'd4'], // Scotch
  ['e4', 'e5', 'Nf3', 'Nf6'], // Petroff
  ['e4', 'e5', 'Nc3'], // Vienna
  ['e4', 'e5', 'Bc4'], // Bishop's opening
  ['e4', 'e5', 'f4'], // King's gambit
  ['e4', 'c5', 'Nf3', 'd6'], // Sicilian, Najdorf-bound
  ['e4', 'c5', 'Nf3', 'Nc6'], // Sicilian, old
  ['e4', 'c5', 'Nf3', 'e6'], // Sicilian, Kan
  ['e4', 'c5', 'Nc3'], // Closed Sicilian
  ['e4', 'c5', 'd4'], // Smith-Morra
  ['e4', 'e6', 'd4', 'd5'], // French
  ['e4', 'e6', 'Nc3'],
  ['e4', 'c6', 'd4', 'd5'], // Caro-Kann
  ['e4', 'c6', 'Nc3'],
  ['e4', 'd5'], // Scandinavian
  ['e4', 'd6', 'd4', 'Nf6'], // Pirc
  ['e4', 'Nf6'], // Alekhine
  ['e4', 'g6', 'd4', 'Bg7'], // Modern
  ['d4', 'd5', 'c4', 'e6'], // Queen's Gambit declined
  ['d4', 'd5', 'c4', 'c6'], // Slav
  ['d4', 'd5', 'c4', 'dxc4'], // QGA
  ['d4', 'd5', 'Nf3', 'Nf6', 'Bf4'], // London
  ['d4', 'Nf6', 'c4', 'g6', 'Nc3'], // King's Indian
  ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'], // Nimzo-Indian
  ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'b6'], // Queen's Indian
  ['d4', 'Nf6', 'c4', 'c5'], // Benoni
  ['d4', 'f5'], // Dutch
  ['d4', 'e6', 'c4', 'f5'],
  ['Nf3', 'd5', 'g3'], // King's Indian attack
  ['Nf3', 'Nf6', 'c4', 'g6'], // English / KID by transposition
  ['c4', 'e5', 'Nc3'], // English
  ['c4', 'c5', 'Nf3'],
  ['c4', 'Nf6', 'Nc3'],
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'],
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'],
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'],
  ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6'],
  ['d4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6'],
  ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4'],
  ['e4', 'c5', 'Nf3', 'e6', 'd4', 'cxd4'],
  ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Bb4'],
  ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4'],
];

/** FEN keys (board + side + castling + ep, no move counters) that count as "book". */
export const BOOK_POSITIONS: Set<string> = buildBookSet();

export function fenKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

function buildBookSet(): Set<string> {
  const keys = new Set<string>();
  for (const line of LINES) {
    const chess = new Chess();
    keys.add(fenKey(chess.fen()));
    for (const san of line) {
      try {
        chess.move(san);
      } catch {
        break;
      }
      keys.add(fenKey(chess.fen()));
    }
  }
  return keys;
}

/** True when the position is one of the known opening positions above. */
export function isBookPosition(fen: string): boolean {
  return BOOK_POSITIONS.has(fenKey(fen));
}

export const BOOK_SIZE = BOOK_POSITIONS.size;
