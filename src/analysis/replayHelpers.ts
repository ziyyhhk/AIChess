import type { Square } from 'chess.js';
import { Chess } from 'chess.js';
import type { AnalyzedPly } from './analyzeGame';
import type { MoveClassification } from './classification';
import type { FlightRequest } from '../components/board/flights';
import type { Arrow } from '../chess/annotationManager';

export const SUGGEST_FOR: MoveClassification[] = ['inaccuracy', 'mistake', 'blunder', 'miss'];
export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const SPEED_OPTIONS = [
  { label: '0.5×', ms: 1600 },
  { label: '1×', ms: 900 },
  { label: '1.5×', ms: 600 },
  { label: '2×', ms: 400 },
];

export function pieceTypeFromPly(ply: AnalyzedPly): string {
  try {
    const chess = new Chess(ply.fenBefore);
    const p = chess.get(ply.uci.slice(0, 2) as Square);
    if (p) return p.type;
  } catch {
    /* ignore */
  }
  if (/^[NBRQK]/.test(ply.san)) return ply.san[0].toLowerCase();
  return 'p';
}

export function plyToAnimation(ply: AnalyzedPly, animId: number): FlightRequest {
  return {
    id: `review-${ply.ply}-${animId}`,
    from: ply.uci.slice(0, 2) as Square,
    to: ply.uci.slice(2, 4) as Square,
    color: ply.side,
    type: pieceTypeFromPly(ply),
    isCastle: ply.san === 'O-O' || ply.san === 'O-O-O',
  };
}

export function arrowsForPly(ply: AnalyzedPly | null): Arrow[] {
  if (!ply) return [];
  const out: Arrow[] = [
    {
      from: ply.uci.slice(0, 2) as Square,
      to: ply.uci.slice(2, 4) as Square,
      color: 'green',
    },
  ];
  if (
    ply.bestMove &&
    ply.bestMove.uci !== ply.uci &&
    (SUGGEST_FOR.includes(ply.classification) || ply.critical)
  ) {
    out.push({
      from: ply.bestMove.uci.slice(0, 2) as Square,
      to: ply.bestMove.uci.slice(2, 4) as Square,
      color: 'blue',
    });
  }
  return out;
}
