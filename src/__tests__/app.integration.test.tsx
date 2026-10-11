// @vitest-environment jsdom
/**
 * End-to-end behaviour of the real App component in jsdom:
 * select a pawn, move it, check the sound and the animation, export the PGN and
 * run a full analysis.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const plays: { kind: 'move' | 'sound'; value: unknown }[] = [];

vi.mock('../audio/soundManager', () => {
  const record = (kind: 'move' | 'sound', value: unknown) => {
    plays.push({ kind, value });
    return true;
  };
  const manager = {
    playMove: (event: unknown) => record('move', event),
    play: (id: string) => record('sound', id),
    unlock: () => undefined,
    preload: () => undefined,
    setEnabled: () => undefined,
    setVolume: () => undefined,
    getVolume: () => 0.7,
    setPack: () => undefined,
    getPack: () => 'builtin',
    stats: () => ({ registered: 0, loaded: 0, failed: 0 }),
    isEnabled: () => true,
    isUnlocked: () => true,
  };
  return { soundManager: manager, SoundManager: class {} };
});

vi.mock('../ai/aiManager', () => {
  const info = {
    id: 'stockfish',
    name: 'Stockfish',
    provider: 'Built-in engine',
    providerId: 'stockfish',
    free: true,
    requiresKey: false,
  };
  return {
    aiManager: {
      setModel: () => undefined,
      setDifficulty: () => undefined,
      setThinkTime: () => undefined,
      getModelId: () => 'stockfish',
      getModelInfo: () => info,
      getThinkTargetMs: () => 0,
      cancel: () => undefined,
      // A deliberately slow opponent so the premove window is real.
      requestMove: async (request: { legalMoves: string[] }) => {
        await new Promise((resolve) => setTimeout(resolve, 220));
        return { move: request.legalMoves[0] };
      },
    },
  };
});

import App from '../App';
import type { ChessBoard } from '../components/ChessBoard';

const BOARD_RECT = { left: 0, top: 0, width: 800, height: 800, right: 800, bottom: 800, x: 0, y: 0 };

/** Centre of a square, in board pixels, for the white orientation. */
function squareCentre(square: string): { x: number; y: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1], 10);
  return { x: file * 100 + 50, y: (8 - rank) * 100 + 50 };
}

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom has no layout: hand the board a real rectangle and record animations.
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this.classList?.contains('chessboard-wrap')) {
      return { ...BOARD_RECT, toJSON: () => BOARD_RECT } as DOMRect;
    }
    return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  };
  (Element.prototype as unknown as { animate: unknown }).animate = function () {
    return { onfinish: null, cancel: () => undefined, playState: 'running' } as unknown as Animation;
  };
});

beforeEach(() => {
  plays.length = 0;
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<App />);
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function board(): HTMLElement {
  const element = document.querySelector('.chessboard-wrap');
  if (!element) throw new Error('board not rendered');
  return element as HTMLElement;
}

function press(square: string, button = 0) {
  const { x, y } = squareCentre(square);
  const element = board();
  const down = new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y, button });
  act(() => {
    element.dispatchEvent(down);
  });
}

function release(square: string) {
  const { x, y } = squareCentre(square);
  const element = board();
  act(() => {
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y, button: 0 }));
  });
}

function squareEl(square: string): HTMLElement {
  const element = document.querySelector(`[data-square="${square}"]`);
  if (!element) throw new Error(`square ${square} not found`);
  return element as HTMLElement;
}

/** Poll until `condition` holds, letting React and the event loop run. */
async function waitFor(condition: () => boolean, label: string, timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (condition()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
  throw new Error(`timed out waiting for ${label}`);
}

function plyCount(): number {
  // The move list always renders two slots per row; only filled ones are moves.
  return Array.from(document.querySelectorAll('.gp-san')).filter(
    (el) => (el.textContent || '').trim().length > 0
  ).length;
}

/** Waits until the AI has replied and it is the player's turn again. */
async function waitForPlayerTurn(expectedPlies: number) {
  await waitFor(() => plyCount() >= expectedPlies, `${expectedPlies} plies played`, 12000);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

function clickButton(label: string) {
  const buttons = Array.from(document.querySelectorAll('button'));
  const button = buttons.find((b) => (b.textContent || '').trim().toLowerCase().includes(label.toLowerCase()));
  if (!button) throw new Error(`button "${label}" not found: ${buttons.map((b) => b.textContent).join(' | ')}`);
  act(() => {
    (button as HTMLButtonElement).click();
  });
  return button as HTMLButtonElement;
}

describe('playing a move', () => {
  it('selects a pawn without moving it or playing a sound', () => {
    press('e2');
    release('e2');
    expect(squareEl('e2').className).toContain('selected');
    // Selecting is not a move: no move sound, no illegal sound.
    expect(plays).toHaveLength(0);
    expect(document.querySelector('[data-testid="flying-piece"]')).toBeNull();
  });

  it('switches between two own pawns without playing the illegal sound', () => {
    press('e2');
    release('e2');
    press('d2');
    release('d2');
    expect(squareEl('d2').className).toContain('selected');
    expect(squareEl('e2').className).not.toContain('selected');
    expect(plays.filter((p) => p.value === 'illegal')).toHaveLength(0);
    expect(plays).toHaveLength(0);
  });

  it('plays one move sound and animates the pawn for e2-e4', () => {
    press('e2');
    release('e2');
    press('e4');
    release('e4');

    // The pawn really travelled: an overlay piece is in the air towards e4.
    const flying = document.querySelector('[data-testid="flying-piece"]');
    expect(flying).not.toBeNull();
    expect(flying!.getAttribute('data-to')).toBe('e4');
    expect(flying!.querySelector('img')?.getAttribute('src')).toContain('wP.svg');
    // ...and the destination square is empty until it lands.
    expect(squareEl('e4').querySelector('img')).toBeNull();

    // Exactly one move sound, for the player.
    const moveSounds = plays.filter((p) => p.kind === 'move');
    expect(moveSounds).toHaveLength(1);
    expect((moveSounds[0].value as { actor: string }).actor).toBe('player');
  });

  it('plays the same sound for a knight move as for a pawn move', async () => {
    press('e2');
    press('e4');
    release('e4');
    // The opponent replies on its own; wait for the board to come back.
    await waitForPlayerTurn(2);

    press('g1');
    press('f3');
    release('f3');

    const moveSounds = plays.filter((p) => p.kind === 'move').map((p) => p.value as { actor: string });
    // Player pawn move, opponent reply, player knight move.
    expect(moveSounds.length).toBeGreaterThanOrEqual(3);
    expect(moveSounds[0].actor).toBe('player');
    expect(moveSounds[1].actor).toBe('opponent');
    expect(moveSounds[2].actor).toBe('player');
  });

  it('never plays the illegal sound for a legal move, and does for a rejected one', () => {
    press('e2');
    press('e4');
    release('e4');
    expect(plays.some((p) => p.value === 'illegal')).toBe(false);

    // An empty square with nothing selected is simply ignored.
    press('d5');
    release('d5');
    expect(plays.some((p) => p.value === 'illegal')).toBe(false);

    // e2 is empty now; clicking e5 with nothing selected must not be "illegal".
    press('e5');
    release('e5');
    expect(plays.some((p) => p.value === 'illegal')).toBe(false);
  });
});

describe('premoves', () => {
  it('queues a premove while the opponent is thinking and plays it afterwards', async () => {
    press('e2');
    press('e4');
    release('e4');

    // The opponent is thinking: the player queues a2-a4.
    press('a2');
    press('a4');
    release('a4');
    expect(plays.some((p) => p.value === 'premove')).toBe(true);
    expect(document.querySelector('.gp-premove')?.textContent).toContain('a2 → a4');

    // Once the opponent's move has landed, the premove plays by itself.
    await waitFor(() => plyCount() >= 4, 'the premove to be played', 12000);
    const plies = Array.from(document.querySelectorAll('.gp-san'))
      .map((el) => (el.textContent || '').trim())
      .filter(Boolean);
    expect(plies[2]).toBe('a4');

    // It plays exactly one sound for the player's move...
    const playerSounds = plays.filter(
      (p) => p.kind === 'move' && (p.value as { actor: string }).actor === 'player'
    );
    expect(playerSounds).toHaveLength(2);
    // ...and no illegal-move sound was ever played for queueing it.
    expect(plays.some((p) => p.value === 'illegal')).toBe(false);
  }, 15000);
});

describe('export', () => {
  it('copies the real game as PGN from the panel button', async () => {
    press('e2');
    press('e4');
    release('e4');
    await waitForPlayerTurn(2);
    press('g1');
    press('f3');
    release('f3');

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await act(async () => {
      clickButton('Copy PGN');
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    const pgn = writeText.mock.calls[0][0] as string;
    expect(pgn).toContain('[White "You"]');
    expect(pgn).toContain('e4');
    expect(pgn).toContain('Nf3');
    expect(pgn.trim().endsWith('*')).toBe(true);
  });
});

describe('copy fallback', () => {
  it('shows selectable PGN text when the clipboard refuses', async () => {
    press('e2');
    press('e4');
    release('e4');
    await waitForPlayerTurn(2);

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    });
    // jsdom has no document.execCommand, so both clipboard routes fail.
    await act(async () => {
      clickButton('Copy PGN');
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const fallback = document.querySelector('.gp-pgn-fallback') as HTMLTextAreaElement;
    expect(fallback).not.toBeNull();
    expect(fallback.value).toContain('[White "You"]');
    expect(fallback.readOnly).toBe(true);
    expect(document.querySelector('.gp-pgn-feedback')?.textContent).toContain('blocked');
  }, 15000);
});

describe('history', () => {
  it('keeps a real game in this browser and lists it', async () => {
    press('e2');
    press('e4');
    release('e4');
    await waitForPlayerTurn(2);

    act(() => {
      clickButton('New game');
    });
    // The abandoned game is archived with the `*` result token, not a fake score.
    const stored = JSON.parse(localStorage.getItem('aichess-history') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].result).toBe('*');
    expect(stored[0].plies).toBe(2);
    expect(stored[0].pgn).toContain('[White "You"]');

    act(() => {
      (document.querySelector('[aria-label="History"]') as HTMLButtonElement).click();
    });
    const rows = document.querySelectorAll('.history-item');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Unfinished');
    expect(rows[0].textContent).toContain('1 moves');
  }, 15000);
});

describe('analysis', () => {
  it('analyses the played game and lists the graded moves', async () => {
    // Stockfish cannot load here (no network), so the app must fall back to its
    // own search and say so - never invent numbers.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network disabled in tests'))
    );

    press('e2');
    press('e4');
    release('e4');
    await waitForPlayerTurn(2);

    await act(async () => {
      clickButton('Analyse game');
    });
    await waitFor(
      () => document.querySelectorAll('.analysis-move-row').length >= 2 && !document.querySelector('.analysis-progress'),
      'the analysis to finish',
      15000
    );

    const rows = document.querySelectorAll('.analysis-move-row');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('e4');
    // Every row carries a classification glyph and a text label.
    expect(rows[0].querySelector('[data-classification]')).not.toBeNull();
    expect(document.querySelector('.analysis-summary')).not.toBeNull();
    expect(document.querySelector('.eval-graph')).not.toBeNull();
    // The fallback is disclosed rather than passed off as Stockfish.
    expect(document.querySelector('.analysis-warning')?.textContent).toMatch(/fallback|Stockfish/i);

    // Selecting a move shows the review board, not the live game.
    act(() => {
      (rows[0] as HTMLButtonElement).click();
    });
    expect(document.querySelector('.analysis-board-note')?.textContent).toContain('review board');
    vi.unstubAllGlobals();
  }, 30000);
});

// Keeps the ChessBoard type import referenced for the JSX above.
export type _BoardProps = React.ComponentProps<typeof ChessBoard>;
