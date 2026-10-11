import { describe, it, expect } from 'vitest';
import { AnnotationManager } from '../chess/annotationManager';
import { isKnightDelta } from '../components/board/flights';

describe('isKnightDelta (used for arrow shapes)', () => {
  const dirs: [number, number][] = [
    [2, 1],
    [2, -1],
    [-2, 1],
    [-2, -1],
    [1, 2],
    [1, -2],
    [-1, 2],
    [-1, -2],
  ];

  it('accepts all eight knight directions', () => {
    for (const [dx, dy] of dirs) expect(isKnightDelta(dx, dy), `${dx},${dy}`).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isKnightDelta(1, 1)).toBe(false);
    expect(isKnightDelta(0, 2)).toBe(false);
    expect(isKnightDelta(3, 1)).toBe(false);
  });
});

describe('AnnotationManager', () => {
  it('adds an arrow and toggles it off again', () => {
    const manager = new AnnotationManager();
    manager.addArrow('e2', 'e4');
    expect(manager.getArrows()).toEqual([{ from: 'e2', to: 'e4', color: 'green' }]);
    manager.addArrow('e2', 'e4');
    expect(manager.getArrows()).toEqual([]);
  });

  it('cycles arrow colours so consecutive arrows differ', () => {
    const manager = new AnnotationManager();
    manager.addArrow('e2', 'e4');
    manager.addArrow('d2', 'd4');
    const colors = manager.getArrows().map((a) => a.color);
    expect(new Set(colors).size).toBe(2);
  });

  it('ignores a zero-length arrow', () => {
    const manager = new AnnotationManager();
    manager.addArrow('e2', 'e2');
    expect(manager.getArrows()).toEqual([]);
  });

  it('toggles square highlights', () => {
    const manager = new AnnotationManager();
    manager.toggleHighlight('d5');
    expect(manager.getHighlights()).toHaveLength(1);
    manager.toggleHighlight('d5');
    expect(manager.getHighlights()).toHaveLength(0);
  });

  it('clears everything, like when a move is played', () => {
    const manager = new AnnotationManager();
    manager.addArrow('e2', 'e4');
    manager.toggleHighlight('d5');
    manager.clear();
    expect(manager.getArrows()).toEqual([]);
    expect(manager.getHighlights()).toEqual([]);
  });

  it('hands out copies so callers cannot mutate internal state', () => {
    const manager = new AnnotationManager();
    manager.addArrow('e2', 'e4');
    manager.getArrows().push({ from: 'a1', to: 'a2', color: 'red' });
    expect(manager.getArrows()).toHaveLength(1);
  });
});
