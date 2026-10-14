import type { Square } from 'chess.js';

export interface Premove {
  from: Square;
  to: Square;
  promotion?: string;
}

export class PremoveManager {
  private premove: Premove | null = null;
  private enabled = true;

  setEnabled(v: boolean) {
    this.enabled = v;
    if (!v) this.clear();
  }

  isEnabled() {
    return this.enabled;
  }

  set(from: Square, to: Square, promotion?: string) {
    if (!this.enabled) return;
    this.premove = { from, to, promotion };
  }

  get(): Premove | null {
    return this.premove;
  }

  clear() {
    this.premove = null;
  }

  /** Returns the premove if still legal against the given legal UCI list, else null and clears. */
  consumeIfLegal(legalUci: string[]): Premove | null {
    if (!this.premove) return null;
    const uci =
      this.premove.from +
      this.premove.to +
      (this.premove.promotion || '');
    if (legalUci.includes(uci)) {
      const p = this.premove;
      this.premove = null;
      return p;
    }
    const short = this.premove.from + this.premove.to;
    if (legalUci.some((m) => m.startsWith(short))) {
      const match = legalUci.find((m) => m.startsWith(short))!;
      const promo = match.length > 4 ? match[4] : undefined;
      const p = { ...this.premove, promotion: promo };
      this.premove = null;
      return p;
    }
    this.premove = null;
    return null;
  }
}
