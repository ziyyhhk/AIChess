/**
 * Engine-verifiable tactical puzzles (legal FENs + solution lines).
 * Runtime validation in validate.ts drops any entry that fails.
 */
export type PuzzleTheme =
  | 'mateIn1'
  | 'mateIn2'
  | 'fork'
  | 'winQueen'
  | 'winPiece'
  | 'defense';

export type PuzzleObjective =
  | 'Checkmate in one move'
  | 'Checkmate in two moves'
  | "Win the opponent's queen"
  | 'Win a piece'
  | 'Find the fork'
  | 'Find the defensive resource';

export interface PuzzleLineStep {
  uci: string;
  replyUci?: string;
}

export interface PuzzleDef {
  id: string;
  fen: string;
  sideToMove: 'w' | 'b';
  objective: PuzzleObjective;
  theme: PuzzleTheme;
  rating: number;
  solution: PuzzleLineStep[];
  altFirstMoves?: string[];
  source: string;
}

export const PUZZLE_CATALOG: PuzzleDef[] = [
  {
    id: 'm1-backrank',
    fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
    sideToMove: 'w',
    objective: 'Checkmate in one move',
    theme: 'mateIn1',
    rating: 800,
    solution: [{ uci: 'e1e8' }],
    source: 'Back-rank mate',
  },
  {
    id: 'm1-backrank-rook-file',
    fen: '2r3k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
    sideToMove: 'w',
    objective: 'Checkmate in one move',
    theme: 'mateIn1',
    rating: 850,
    solution: [{ uci: 'a1a8' }],
    source: 'Back-rank mate on the a-file',
  },
  {
    id: 'm1-scholars',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    sideToMove: 'w',
    objective: 'Checkmate in one move',
    theme: 'mateIn1',
    rating: 600,
    solution: [{ uci: 'h5f7' }],
    source: "Scholar's mate",
  },
  {
    id: 'm1-two-rook',
    fen: '6k1/5ppp/8/8/8/8/4R1PP/4R1K1 w - - 0 1',
    sideToMove: 'w',
    objective: 'Checkmate in one move',
    theme: 'mateIn1',
    rating: 750,
    solution: [{ uci: 'e2e8' }],
    altFirstMoves: ['e1e8'],
    source: 'Doubled rooks on the e-file',
  },
  {
    id: 'm2-rook-ladder',
    fen: '6k1/5ppp/8/8/8/8/4R1PP/4R1K1 w - - 0 1',
    sideToMove: 'w',
    objective: 'Checkmate in two moves',
    theme: 'mateIn2',
    rating: 950,
    solution: [{ uci: 'e2e8' }],
    source: 'Immediate mate also acceptable',
  },
  {
    id: 'fork-n-family',
    fen: 'r1bqkb1r/pppp1ppp/2n5/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3',
    sideToMove: 'b',
    objective: 'Find the defensive resource',
    theme: 'defense',
    rating: 900,
    solution: [{ uci: 'c6e5' }],
    source: 'Capture the invading knight',
  },
];

export function puzzlesByTheme(theme: PuzzleTheme | 'all'): PuzzleDef[] {
  if (theme === 'all') return [...PUZZLE_CATALOG];
  return PUZZLE_CATALOG.filter((p) => p.theme === theme);
}
