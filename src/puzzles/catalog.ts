/**
 * Engine-verifiable tactical puzzles.
 * validate.ts drops any entry whose solution fails.
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
    id: 'm1-backrank-a',
    fen: '6k1/5ppp/8/8/8/8/5PPP/R6K w - - 0 1',
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
    id: 'm1-queen-corner',
    fen: '6k1/5ppp/8/8/8/5Q2/5PPP/6K1 w - - 0 1',
    sideToMove: 'w',
    objective: 'Checkmate in one move',
    theme: 'mateIn1',
    rating: 700,
    solution: [{ uci: 'f3a8' }],
    source: 'Queen to a8 mate',
  },
  {
    id: 'm1-queen-back',
    fen: '6k1/5ppp/8/8/8/8/5PPP/4Q1K1 w - - 0 1',
    sideToMove: 'w',
    objective: 'Checkmate in one move',
    theme: 'mateIn1',
    rating: 720,
    solution: [{ uci: 'e1e8' }],
    source: 'Queen back-rank mate',
  },
  {
    id: 'defense-take-knight',
    fen: 'r1bqkb1r/pppp1ppp/2n5/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3',
    sideToMove: 'b',
    objective: 'Find the defensive resource',
    theme: 'defense',
    rating: 900,
    solution: [{ uci: 'c6e5' }],
    source: 'Capture the knight on e5',
  },
  {
    id: 'm1-rook-open',
    fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
    sideToMove: 'w',
    objective: 'Checkmate in one move',
    theme: 'mateIn1',
    rating: 780,
    solution: [{ uci: 'a1a8' }],
    source: 'Rook on open a-file',
  },
];

export function puzzlesByTheme(theme: PuzzleTheme | 'all'): PuzzleDef[] {
  if (theme === 'all') return [...PUZZLE_CATALOG];
  return PUZZLE_CATALOG.filter((p) => p.theme === theme);
}
