import { describe, it, expect } from 'vitest';
import { AnnotationManager } from '../chess/annotationManager';

/** Same logic as ChessBoard knight detection */
function isKnightDelta(dx: number, dy: number) {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  return (ax === 2 && ay === 1) || (ax === 1 && ay === 2);
}

describe('isKnightDelta', () => {
  const dirs: [number, number][] = [
    [2, 1], [2, -1], [-2, 1], [-2, -1],
    [1, 2], [1, -2], [-1, 2], [-1, -2],
  ];
  it('accepts all eight knight directions', () => {
    for (const [dx, dy] of dirs) {
      expect(isKnightDelta(dx, dy)).toBe(true);
    }
  });
  it('rejects non-knight displacements', () => {
    expect(isKnightDelta(1, 1)).toBe(false);
    expect(isKnightDelta(0, 2)).toBe(false);
    expect(isKnightDelta(3, 1)).toBe(false);
    expect(isKnightDelta(0, 0)).toBe(false);
  });
});

describe('AnnotationManager', () => {
  it('adds and clears arrows', () => {
    const m = new AnnotationManager();
    m.addArrow('e2', 'e4');
    m.addArrow('g1', 'f3');
    expect(m.getArrows().length).toBe(2);
    m.clear();
    expect(m.getArrows().length).toBe(0);
    expect(m.getHighlights().length).toBe(0);
  });

  it('toggles highlights and clears them', () => {
    const m = new AnnotationManager();
    m.toggleHighlight('e4');
    expect(m.getHighlights().length).toBe(1);
    m.toggleHighlight('e4');
    expect(m.getHighlights().length).toBe(0);
  });

  it('toggles off identical arrows', () => {
    const m = new AnnotationManager();
    m.addArrow('a1', 'a8');
    m.addArrow('a1', 'a8');
    expect(m.getArrows().length).toBe(0);
  });
});
