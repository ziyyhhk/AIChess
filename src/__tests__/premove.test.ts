import { describe, it, expect } from 'vitest';
import { PremoveManager } from '../chess/premoveManager';

describe('PremoveManager', () => {
  it('stores and returns a queued premove', () => {
    const manager = new PremoveManager();
    manager.set('e2', 'e4');
    expect(manager.get()).toEqual({ from: 'e2', to: 'e4' });
  });

  it('plays the premove when it is still legal', () => {
    const manager = new PremoveManager();
    manager.set('e2', 'e4');
    expect(manager.consumeIfLegal(['e2e4', 'd2d4'])).toEqual({ from: 'e2', to: 'e4' });
    expect(manager.get()).toBeNull();
  });

  it('picks up the promotion piece when the pawn reached the last rank', () => {
    const manager = new PremoveManager();
    manager.set('e7', 'e8');
    expect(manager.consumeIfLegal(['e7e8q', 'e7e8n'])).toEqual({
      from: 'e7',
      to: 'e8',
      promotion: 'q',
    });
  });

  it('discards a premove that the opponent made impossible', () => {
    const manager = new PremoveManager();
    manager.set('e2', 'e4');
    expect(manager.consumeIfLegal(['d2d4', 'g1f3'])).toBeNull();
    expect(manager.get()).toBeNull();
  });

  it('clears on demand and when disabled', () => {
    const manager = new PremoveManager();
    manager.set('e2', 'e4');
    manager.clear();
    expect(manager.get()).toBeNull();
    manager.set('e2', 'e4');
    manager.setEnabled(false);
    expect(manager.get()).toBeNull();
  });

  it('ignores new premoves while disabled', () => {
    const manager = new PremoveManager();
    manager.setEnabled(false);
    manager.set('e2', 'e4');
    expect(manager.get()).toBeNull();
  });

  it('returns nothing when there was no premove', () => {
    const manager = new PremoveManager();
    expect(manager.consumeIfLegal(['e2e4'])).toBeNull();
  });
});
