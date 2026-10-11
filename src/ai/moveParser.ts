import type { UCIMove } from './types';

const UCI_RE = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/i;

/** Extract a UCI move from free-form model text or JSON. */
export function parseMoveFromResponse(
  text: string,
  legalMoves: string[]
): UCIMove | null {
  if (!text) return null;
  const cleaned = text.trim();

  const direct = cleaned.match(UCI_RE);
  if (direct) {
    const uci = (direct[1] + direct[2] + (direct[3] || '')).toLowerCase();
    if (legalMoves.includes(uci)) return uci;
  }

  try {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const obj = JSON.parse(jsonMatch[0]);
      const candidate =
        obj.move || obj.uci || obj.best_move || obj.bestMove || obj.response;
      if (typeof candidate === 'string') {
        const m = candidate.trim().toLowerCase().match(UCI_RE);
        if (m) {
          const uci = (m[1] + m[2] + (m[3] || '')).toLowerCase();
          if (legalMoves.includes(uci)) return uci;
        }
      }
    }
  } catch {
    // ignore
  }

  const tokens = cleaned.toLowerCase().split(/[\s,;:"'`()[\]{}]+/);
  for (const t of tokens) {
    const m = t.match(UCI_RE);
    if (m) {
      const uci = (m[1] + m[2] + (m[3] || '')).toLowerCase();
      if (legalMoves.includes(uci)) return uci;
    }
  }

  return null;
}
