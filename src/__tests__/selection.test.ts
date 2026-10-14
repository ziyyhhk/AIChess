import { describe, it, expect } from 'vitest';
import { resolveDropIntent, resolveSquareClick, type ClickContext } from '../chess/clickIntent';

function click(overrides: Partial<ClickContext>): ReturnType<typeof resolveSquareClick> {
  return resolveSquareClick({
    selected: null,
    clicked: 'e4',
    clickedPiece: null,
    playerColor: 'w',
    isPlayerTurn: true,
    premovesEnabled: true,
    gameOver: false,
    legalTargets: [],
    promotionTargets: [],
    ...overrides,
  });
}

describe('selecting pieces never plays the illegal-move sound', () => {
  it('selects a piece when nothing is selected', () => {
    expect(click({ clicked: 'e2', clickedPiece: { color: 'w' } })).toEqual({ kind: 'select', square: 'e2' });
  });

  it('switches between two friendly pieces instead of playing illegal', () => {
    expect(
      click({ selected: 'e2', clicked: 'd2', clickedPiece: { color: 'w' } })
    ).toEqual({ kind: 'select', square: 'd2' });
  });

  it('deselects when the same square is clicked twice', () => {
    expect(click({ selected: 'e2', clicked: 'e2', clickedPiece: { color: 'w' } })).toEqual({ kind: 'deselect' });
  });

  it('ignores a click on an empty square with nothing selected', () => {
    expect(click({ clicked: 'e4', clickedPiece: null })).toEqual({ kind: 'ignore' });
  });

  it('ignores clicks on the opponent pieces when nothing is selected', () => {
    expect(click({ clicked: 'e5', clickedPiece: { color: 'b' } })).toEqual({ kind: 'ignore' });
  });

  it('ignores clicks after the game is over', () => {
    expect(click({ gameOver: true, clicked: 'e2', clickedPiece: { color: 'w' } })).toEqual({ kind: 'ignore' });
  });
});

describe('move attempts', () => {
  it('moves to a legal destination', () => {
    expect(
      click({ selected: 'e2', clicked: 'e4', legalTargets: ['e3', 'e4'] })
    ).toEqual({ kind: 'move', from: 'e2', to: 'e4' });
  });

  it('reports illegal only for a destination the rules engine rejects', () => {
    expect(click({ selected: 'e2', clicked: 'e5', legalTargets: ['e3', 'e4'] })).toEqual({ kind: 'illegal' });
  });

  it('asks for a promotion piece instead of moving', () => {
    expect(
      click({ selected: 'e7', clicked: 'e8', legalTargets: ['e8'], promotionTargets: ['e8'] })
    ).toEqual({ kind: 'promote', from: 'e7', to: 'e8' });
  });

  it('captures an enemy piece on a legal square', () => {
    expect(
      click({ selected: 'e4', clicked: 'd5', clickedPiece: { color: 'b' }, legalTargets: ['d5'] })
    ).toEqual({ kind: 'move', from: 'e4', to: 'd5' });
  });
});

describe('premoves while the opponent is thinking', () => {
  const outOfTurn = { isPlayerTurn: false } as const;

  it('selects a friendly piece', () => {
    expect(click({ ...outOfTurn, clicked: 'e2', clickedPiece: { color: 'w' } })).toEqual({
      kind: 'select',
      square: 'e2',
    });
  });

  it('queues a premove for any destination', () => {
    expect(click({ ...outOfTurn, selected: 'e2', clicked: 'e4' })).toEqual({
      kind: 'premove',
      from: 'e2',
      to: 'e4',
    });
  });

  it('switches selection instead of queueing a premove onto your own piece', () => {
    expect(click({ ...outOfTurn, selected: 'e2', clicked: 'd2', clickedPiece: { color: 'w' } })).toEqual({
      kind: 'select',
      square: 'd2',
    });
  });

  it('never reports illegal out of turn - that is not an illegal move', () => {
    const intent = click({ ...outOfTurn, selected: 'e2', clicked: 'e5' });
    expect(intent.kind).toBe('premove');
  });

  it('ignores board clicks when premoves are switched off', () => {
    expect(click({ ...outOfTurn, premovesEnabled: false, clicked: 'e2', clickedPiece: { color: 'w' } })).toEqual({
      kind: 'ignore',
    });
  });
});

describe('drag and drop', () => {
  const base = {
    from: 'e2' as const,
    to: 'e4' as const,
    pieceAtFrom: { color: 'w' as const },
    pieceAtTo: null,
    playerColor: 'w' as const,
    isPlayerTurn: true,
    premovesEnabled: true,
    gameOver: false,
    legalTargets: ['e4'] as const,
    promotionTargets: [] as const,
  };

  it('moves a piece dropped on a legal square', () => {
    expect(resolveDropIntent({ ...base, legalTargets: ['e3', 'e4'] })).toEqual({
      kind: 'move',
      from: 'e2',
      to: 'e4',
    });
  });

  it('reports illegal for a rejected drop', () => {
    expect(resolveDropIntent({ ...base, legalTargets: ['e3'] })).toEqual({ kind: 'illegal' });
  });

  it('selects when dropped on your own piece', () => {
    expect(resolveDropIntent({ ...base, pieceAtTo: { color: 'w' } })).toEqual({
      kind: 'select',
      square: 'e4',
    });
  });

  it('ignores a drop of the opponent piece', () => {
    expect(resolveDropIntent({ ...base, pieceAtFrom: { color: 'b' } })).toEqual({ kind: 'ignore' });
  });

  it('ignores a drop on the same square', () => {
    expect(resolveDropIntent({ ...base, to: 'e2' })).toEqual({ kind: 'ignore' });
  });

  it('queues a premove when dropped out of turn', () => {
    expect(resolveDropIntent({ ...base, isPlayerTurn: false })).toEqual({
      kind: 'premove',
      from: 'e2',
      to: 'e4',
    });
  });
});
