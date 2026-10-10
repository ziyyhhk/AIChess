import type { Square } from 'chess.js';

export type ArrowColor = 'green' | 'red' | 'blue' | 'yellow';
export type HighlightColor = 'green' | 'red' | 'blue' | 'yellow';

export interface Arrow {
  from: Square;
  to: Square;
  color: ArrowColor;
}

export interface SquareHighlight {
  square: Square;
  color: HighlightColor;
}

export class AnnotationManager {
  private arrows: Arrow[] = [];
  private highlights: SquareHighlight[] = [];
  private nextColor: ArrowColor = 'green';

  private colors: ArrowColor[] = ['green', 'red', 'blue', 'yellow'];

  addArrow(from: Square, to: Square, color?: ArrowColor) {
    if (from === to) return;
    const idx = this.arrows.findIndex(
      (a) => a.from === from && a.to === to
    );
    if (idx >= 0) {
      this.arrows.splice(idx, 1);
      return;
    }
    const c = color || this.nextColor;
    this.arrows.push({ from, to, color: c });
    this.cycleColor();
  }

  toggleHighlight(square: Square, color?: HighlightColor) {
    const idx = this.highlights.findIndex((h) => h.square === square);
    if (idx >= 0) {
      this.highlights.splice(idx, 1);
      return;
    }
    this.highlights.push({
      square,
      color: (color || this.nextColor) as HighlightColor,
    });
    this.cycleColor();
  }

  private cycleColor() {
    const i = this.colors.indexOf(this.nextColor);
    this.nextColor = this.colors[(i + 1) % this.colors.length];
  }

  getArrows() {
    return [...this.arrows];
  }

  getHighlights() {
    return [...this.highlights];
  }

  clear() {
    this.arrows = [];
    this.highlights = [];
  }
}
