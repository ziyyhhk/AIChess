// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ChessBoard } from '../components/ChessBoard';
import { piecesFromFen } from '../chess/pieces';
import type { FlightRequest } from '../components/board/flights';

interface RecordedAnimation {
  keyframes: Keyframe[] | PropertyIndexedKeyframes | null;
  options: KeyframeAnimationOptions | number | undefined;
  onfinish: (() => void) | null;
  cancelled: boolean;
}

const animations: RecordedAnimation[] = [];

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom has no Web Animations API: record the calls instead so the test can
  // prove which frames the piece really travels through.
  (Element.prototype as unknown as { animate: unknown }).animate = function (
    this: Element,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions
  ) {
    const record: RecordedAnimation = {
      keyframes,
      options,
      onfinish: null,
      cancelled: false,
    };
    animations.push(record);
    return {
      get onfinish(): (() => void) | null {
        return record.onfinish;
      },
      set onfinish(handler: (() => void) | null) {
        record.onfinish = handler;
      },
      cancel() {
        record.cancelled = true;
      },
      playState: 'running',
    } as unknown as Animation;
  };
});

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function render(node: React.ReactElement) {
  if (!container) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  }
  act(() => {
    root!.render(node);
  });
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  animations.length = 0;
});


function boardProps(overrides: Partial<React.ComponentProps<typeof ChessBoard>> = {}) {
  return {
    pieces: piecesFromFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'),
    orientation: 'w' as const,
    selected: null,
    legalTargets: [],
    lastMove: { from: 'e2' as const, to: 'e4' as const },
    checkSquare: null,
    premove: null,
    arrows: [],
    highlights: [],
    showCoordinates: false,
    showLegalMoves: false,
    interactive: true,
    onSelectSquare: (_sq: string) => undefined,
    onMove: (_from: string, _to: string) => undefined,
    onArrow: (_from: string, _to: string) => undefined,
    onHighlight: (_sq: string) => undefined,
    onClearAnnotations: () => undefined,
    themeClass: 'board-theme-green',
    animation: null,
    ...overrides,
  };
}

const pawnPush: FlightRequest = {
  id: 'move-1',
  from: 'e2',
  to: 'e4',
  color: 'w',
  type: 'p',
  isCastle: false,
};

describe('piece animation in the DOM', () => {
  it('renders a flying piece that travels from the source to the destination square', () => {
    render(<ChessBoard {...boardProps({ animation: pawnPush })} />);
    const flying = document.querySelectorAll('[data-testid="flying-piece"]');
    expect(flying).toHaveLength(1);
    expect(flying[0].getAttribute('data-from')).toBe('e2');
    expect(flying[0].getAttribute('data-to')).toBe('e4');
    expect(flying[0].querySelector('img')?.getAttribute('src')).toContain('wP.svg');

    // The piece really moves: the keyframes go from e2 to e4, i.e. six squares
    // up the board one square at a time - not a fade, not a jump.
    expect(animations).toHaveLength(1);
    const frames = animations[0].keyframes as Keyframe[];
    expect(frames).toHaveLength(2);
    expect(frames[0].transform).toBe('translate3d(400.0000%, 600.0000%, 0)');
    expect(frames[1].transform).toBe('translate3d(400.0000%, 400.0000%, 0)');
    expect(animations[0].options).toMatchObject({ duration: 200, fill: 'forwards' });
  });

  it('hides the destination square while the piece is in the air', () => {
    render(<ChessBoard {...boardProps({ animation: pawnPush })} />);
    // The pawn is rendered by the overlay, not on the square it is travelling to.
    expect(document.querySelector('[data-square="e4"] img')).toBeNull();
    expect(document.querySelector('[data-square="e2"] img')).toBeNull();
  });

  it('settles the piece when the animation finishes and tells the app', () => {
    const settled: string[] = [];
    render(
      <ChessBoard
        {...boardProps({ animation: pawnPush, onAnimationSettled: (id) => settled.push(id) })}
      />
    );
    expect(settled).toEqual([]);
    act(() => {
      animations[0].onfinish?.();
    });
    expect(settled).toEqual(['move-1']);
    expect(document.querySelectorAll('[data-testid="flying-piece"]')).toHaveLength(0);
    // With the overlay gone the piece is drawn on its new square.
    expect(document.querySelector('[data-square="e4"] img')).not.toBeNull();
  });

  it('takes the piece identity from the position, not from the selection', () => {
    render(<ChessBoard {...boardProps({ animation: pawnPush, selected: 'e2' })} />);
    const flying = document.querySelector('[data-testid="flying-piece"]');
    // A white pawn travels; the selection only draws a highlight.
    expect(flying?.querySelector('img')?.getAttribute('src')).toContain('wP.svg');
    expect(document.querySelector('[data-square="e2"]')?.className).toContain('selected');
  });

  it('moves both pieces when castling', () => {
    render(
      <ChessBoard
        {...boardProps({
          pieces: piecesFromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'),
          lastMove: { from: 'e1', to: 'g1' },
          animation: { id: 'castle', from: 'e1', to: 'g1', color: 'w', type: 'k', isCastle: true },
        })}
      />
    );
    const flights = document.querySelectorAll('[data-testid="flying-piece"]');
    expect(flights).toHaveLength(2);
    const kinds = Array.from(flights).map((f) => f.querySelector('img')?.getAttribute('src'));
    expect(kinds.some((src) => src?.includes('wK.svg'))).toBe(true);
    expect(kinds.some((src) => src?.includes('wR.svg'))).toBe(true);
  });

  it('does not animate when animations are switched off', () => {
    const settled: string[] = [];
    render(
      <ChessBoard
        {...boardProps({
          animation: pawnPush,
          animateMoves: false,
          onAnimationSettled: (id) => settled.push(id),
        })}
      />
    );
    expect(document.querySelectorAll('[data-testid="flying-piece"]')).toHaveLength(0);
    expect(settled).toEqual(['move-1']);
    // No animation: the piece is simply on the destination square.
    expect(document.querySelector('[data-square="e4"] img')).not.toBeNull();
  });

  it('respects the reduced-motion preference', () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    const settled: string[] = [];
    render(
      <ChessBoard
        {...boardProps({ animation: pawnPush, onAnimationSettled: (id) => settled.push(id) })}
      />
    );
    expect(document.querySelectorAll('[data-testid="flying-piece"]')).toHaveLength(0);
    expect(settled).toEqual(['move-1']);
    window.matchMedia = original;
  });

  it('lets a piece finish its own move when a new move starts', () => {
    const settled: string[] = [];
    const props = boardProps({ animation: pawnPush, onAnimationSettled: (id) => settled.push(id) });
    const { rerender } = { rerender: render };
    rerender(<ChessBoard {...props} />);
    const second: FlightRequest = {
      id: 'move-2',
      from: 'g1',
      to: 'f3',
      color: 'w',
      type: 'n',
      isCastle: false,
    };
    act(() => {
      root!.render(
        <ChessBoard
          {...boardProps({
            pieces: piecesFromFen('rnbqkbnr/pppppppp/8/8/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 1'),
            animation: second,
            onAnimationSettled: (id) => settled.push(id),
          })}
        />
      );
    });
    const flights = document.querySelectorAll('[data-testid="flying-piece"]');
    expect(flights).toHaveLength(2);
    // The knight is the newest flight and starts from g1.
    const knight = Array.from(flights).find((f) => f.querySelector('img')?.getAttribute('src')?.includes('wN.svg'));
    expect(knight?.getAttribute('data-from')).toBe('g1');
    expect(knight?.getAttribute('data-to')).toBe('f3');
  });

  it('ignores a repeated render of the same move', () => {
    render(<ChessBoard {...boardProps({ animation: pawnPush })} />);
    expect(document.querySelectorAll('[data-testid="flying-piece"]')).toHaveLength(1);
    act(() => {
      root!.render(<ChessBoard {...boardProps({ animation: pawnPush })} />);
    });
    // Same move id: no second overlay, no second animation.
    expect(document.querySelectorAll('[data-testid="flying-piece"]')).toHaveLength(1);
    expect(animations).toHaveLength(1);
  });

  it('starts the slide where a dragged piece was released', () => {
    render(
      <ChessBoard
        {...boardProps({ animation: { ...pawnPush, dropPoint: { x: 4.3, y: 3.4 } } })}
      />
    );
    const frames = animations[0].keyframes as Keyframe[];
    expect(frames[0].transform).toBe('translate3d(430.0000%, 340.0000%, 0)');
    expect(frames[1].transform).toBe('translate3d(400.0000%, 400.0000%, 0)');
  });

  it('clears the overlay when the game is reset', () => {
    render(<ChessBoard {...boardProps({ animation: pawnPush })} />);
    expect(document.querySelectorAll('[data-testid="flying-piece"]')).toHaveLength(1);
    act(() => {
      root!.render(<ChessBoard {...boardProps({ animation: null })} />);
    });
    expect(document.querySelectorAll('[data-testid="flying-piece"]')).toHaveLength(0);
  });
});
