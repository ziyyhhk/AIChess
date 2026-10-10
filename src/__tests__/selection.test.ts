import { describe, it, expect } from 'vitest';

function clickAction(opts: {
  selected: string | null;
  clicked: string;
  clickedOwnPiece: boolean;
  isLegalDest: boolean;
}): 'select' | 'deselect' | 'switch' | 'move' | 'illegal' | 'none' {
  const { selected, clicked, clickedOwnPiece, isLegalDest } = opts;
  if (!selected) {
    return clickedOwnPiece ? 'select' : 'none';
  }
  if (selected === clicked) return 'deselect';
  if (clickedOwnPiece) return 'switch';
  if (isLegalDest) return 'move';
  return 'illegal';
}

describe('selection state machine', () => {
  it('selects own piece with no prior selection', () => {
    expect(
      clickAction({ selected: null, clicked: 'e2', clickedOwnPiece: true, isLegalDest: false })
    ).toBe('select');
  });

  it('switches between own pieces without illegal', () => {
    expect(
      clickAction({ selected: 'e2', clicked: 'd2', clickedOwnPiece: true, isLegalDest: false })
    ).toBe('switch');
  });

  it('deselects when clicking same square', () => {
    expect(
      clickAction({ selected: 'e2', clicked: 'e2', clickedOwnPiece: true, isLegalDest: false })
    ).toBe('deselect');
  });

  it('moves to legal empty square', () => {
    expect(
      clickAction({ selected: 'e2', clicked: 'e4', clickedOwnPiece: false, isLegalDest: true })
    ).toBe('move');
  });

  it('marks illegal only for failed move attempts', () => {
    expect(
      clickAction({ selected: 'e2', clicked: 'e5', clickedOwnPiece: false, isLegalDest: false })
    ).toBe('illegal');
  });
});
