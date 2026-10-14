/**
 * Mate-in-one puzzle generator.
 *
 * Positions come from seeded random legal games, so they look like real play:
 * pieces sit where the game put them, not where a template placed them. That is
 * what stops the set from repeating the way a fixed catalog does.
 *
 * A position is offered only when the side to move (White) is not in check and
 * has exactly one mating move. Anything with zero or several mates is skipped,
 * so the solver's answer is never ambiguous.
 *
 * Cost: a position is checked by playing each legal move and running full mate
 * detection only where the move gives check. That is a few hundred microseconds
 * per position in practice, so a call that tries dozens of random games finishes
 * well inside a frame budget on a laptop.
 */
import { Chess } from 'chess.js';
import type { PuzzleDef } from './catalog';

/** Positions before this move number are mostly opening theory; skip them. */
const MIN_MOVE_NUMBER = 6;
/** Require some Black defence so the mate is not a lone-king formality. */
const MIN_BLACK_DEFENDERS = 2;
/**
 * Share of eligible positions actually tested. Testing every one costs more than
 * the search it saves; sampling keeps the variety and the per-call time bounded.
 */
const CANDIDATE_SAMPLE_RATE = 0.3;

/** Small, fast, seedable PRNG (mulberry32). Same seed, same sequence. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Identity of a position for de-duplication: placement, side, castling, en passant. */
export function positionKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

/** Short stable id derived from the position, so the same position always gets the same id. */
function idFor(key: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `gen-${h.toString(36)}`;
}

/**
 * The one mating move for the side to move, as UCI, or null when there are zero
 * or several. Leaves `position` exactly as it found it.
 */
export function findUniqueMateInOne(
  position: Chess,
  legal = position.moves({ verbose: true })
): string | null {
  let mate: string | null = null;
  for (const m of legal) {
    position.move({ from: m.from, to: m.to, promotion: m.promotion });
    const isMate = position.isCheck() && position.isCheckmate();
    position.undo();
    if (!isMate) continue;
    if (mate !== null) return null;
    mate = m.from + m.to + (m.promotion ?? '');
  }
  return mate;
}

interface BlackDefence {
  /** Black pieces other than pawns and the king: these cover the most squares. */
  heavy: number;
  /** Black pawns. They cover little but still have to be seen past. */
  pawns: number;
}

function blackDefence(board: ReturnType<Chess['board']>): BlackDefence {
  const defence: BlackDefence = { heavy: 0, pawns: 0 };
  for (const row of board) {
    for (const piece of row) {
      if (!piece || piece.color !== 'b' || piece.type === 'k') continue;
      if (piece.type === 'p') defence.pawns++;
      else defence.heavy++;
    }
  }
  return defence;
}

/**
 * Difficulty from the position. Non-pawn defenders weigh most, because they are
 * what the solver has to see past; pawns add a little. Kept between 700 and 1100
 * so the scale sits next to the catalog's mate-in-one entries (800-850).
 */
export function ratingForDefence({ heavy, pawns }: BlackDefence): number {
  return Math.min(1100, Math.max(700, 700 + 30 * heavy + 5 * pawns));
}

/** Rating for a stored position, computed from the FEN. */
export function ratingForFen(fen: string): number {
  return ratingForDefence(blackDefence(new Chess(fen).board()));
}

export interface GenerateOptions {
  /** Source of randomness. Pass a seeded `mulberry32` for repeatable output. */
  rng?: () => number;
  /** Random games to play before giving up. */
  maxGames?: number;
  /** Plies per random game. */
  maxPliesPerGame?: number;
  /** Position keys (see `positionKey`) that must not be offered again. */
  avoid?: ReadonlySet<string>;
}

/**
 * Plays random legal games and returns the first position that is a clean
 * mate-in-one for White, or null if none turned up within the budget.
 */
export function generateMateInOne(options: GenerateOptions = {}): PuzzleDef | null {
  const rng = options.rng ?? Math.random;
  const maxGames = options.maxGames ?? 60;
  const maxPlies = options.maxPliesPerGame ?? 100;
  const avoid = options.avoid ?? new Set<string>();

  for (let g = 0; g < maxGames; g++) {
    const game = new Chess();
    for (let ply = 0; ply < maxPlies; ply++) {
      // Legal moves are generated once per ply and reused for the candidate check
      // and the random move, so a ply costs one generation, not several.
      const legal = game.moves({ verbose: true });
      if (legal.length === 0) break; // mate or stalemate: this game is over

      if (
        game.turn() === 'w' &&
        game.moveNumber() >= MIN_MOVE_NUMBER &&
        rng() < CANDIDATE_SAMPLE_RATE &&
        !game.isCheck()
      ) {
        const defence = blackDefence(game.board());
        if (defence.heavy + defence.pawns >= MIN_BLACK_DEFENDERS) {
          const fen = game.fen();
          const key = positionKey(fen);
          if (!avoid.has(key)) {
            const uci = findUniqueMateInOne(game, legal);
            if (uci) {
              return {
                id: idFor(key),
                fen,
                sideToMove: 'w',
                objective: 'Checkmate in one move',
                theme: 'mateIn1',
                rating: ratingForDefence(defence),
                solution: [{ uci }],
                source: 'Position from a random game',
              };
            }
          }
        }
      }

      const pick = legal[Math.floor(rng() * legal.length)];
      game.move({ from: pick.from, to: pick.to, promotion: pick.promotion });
    }
  }
  return null;
}
