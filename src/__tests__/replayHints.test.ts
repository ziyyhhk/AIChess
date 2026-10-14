import { describe, it, expect } from 'vitest';

/** Mirrors AnalysisView arrowsForPly without React. */
function arrowsForPly(ply: {
  uci: string;
  bestMove: { uci: string; san: string } | null;
  classification: string;
  critical: boolean;
} | null) {
  if (!ply) return [];
  const out = [
    { from: ply.uci.slice(0, 2), to: ply.uci.slice(2, 4), color: 'green' },
  ];
  const suggest = ['inaccuracy', 'mistake', 'blunder', 'miss'].includes(ply.classification);
  if (ply.bestMove && ply.bestMove.uci !== ply.uci && (suggest || ply.critical)) {
    out.push({
      from: ply.bestMove.uci.slice(0, 2),
      to: ply.bestMove.uci.slice(2, 4),
      color: 'blue',
    });
  }
  return out;
}

describe('analysis replay annotations', () => {
  it('shows only the played move when it matches the engine', () => {
    const arrows = arrowsForPly({
      uci: 'e2e4',
      bestMove: { uci: 'e2e4', san: 'e4' },
      classification: 'best',
      critical: false,
    });
    expect(arrows).toHaveLength(1);
    expect(arrows[0].color).toBe('green');
  });

  it('adds a blue engine arrow for blunders with a different best move', () => {
    const arrows = arrowsForPly({
      uci: 'd2d4',
      bestMove: { uci: 'e2e4', san: 'e4' },
      classification: 'blunder',
      critical: true,
    });
    expect(arrows).toHaveLength(2);
    expect(arrows[1].color).toBe('blue');
    expect(arrows[1].from).toBe('e2');
  });

  it('returns no arrows for the starting position', () => {
    expect(arrowsForPly(null)).toEqual([]);
  });
});

describe('hint level progression', () => {
  function hintReveal(level: 1 | 2 | 3, from: string, to: string) {
    if (level === 1) return { text: 'strategic', arrow: null as null | { from: string; to: string } };
    if (level === 2) return { text: `piece ${from}`, arrow: null };
    return { text: `move ${from}-${to}`, arrow: { from, to } };
  }

  it('level 1 never reveals coordinates', () => {
    const h = hintReveal(1, 'e2', 'e4');
    expect(h.arrow).toBeNull();
    expect(h.text).toBe('strategic');
  });

  it('level 3 reveals the full move', () => {
    const h = hintReveal(3, 'g1', 'f3');
    expect(h.arrow).toEqual({ from: 'g1', to: 'f3' });
  });
});
