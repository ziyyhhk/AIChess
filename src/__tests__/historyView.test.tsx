// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { HistoryView } from '../components/HistoryView';
import type { ArchivedGame } from '../history/archive';

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function render(element: React.ReactElement): HTMLDivElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => createRoot(container).render(element));
  return container;
}

function game(over: Partial<ArchivedGame> = {}): ArchivedGame {
  return {
    id: 'g1',
    startedAt: '2026-01-01T10:00:00.000Z',
    finishedAt: '2026-01-01T10:05:00.000Z',
    white: 'You',
    black: 'Stockfish',
    result: '1-0',
    plies: 24,
    playerColor: 'w',
    pgn: '[Event "AIChess Casual Game"]\n\n1. e4 e5 1-0\n',
    unfinished: false,
    ...over,
  };
}

const noop = () => undefined;

describe('HistoryView', () => {
  it('shows an honest empty state', () => {
    const container = render(
      <HistoryView games={[]} onCopy={async () => true} onDownload={noop} onDelete={noop} onClear={noop} />
    );
    expect(container.textContent).toContain('No games yet');
    expect(container.querySelector('.history-list')).toBeNull();
    // Nothing to clear, so no destructive button either.
    expect(container.querySelector('button')).toBeNull();
    container.remove();
  });

  it('lists stored games with their real facts', () => {
    const container = render(
      <HistoryView
        games={[game(), game({ id: 'g2', result: '0-1', playerColor: 'b', plies: 40, unfinished: true })]}
        onCopy={async () => true}
        onDownload={noop}
        onDelete={noop}
        onClear={noop}
      />
    );
    const rows = container.querySelectorAll('.history-item');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('You');
    expect(rows[0].textContent).toContain('Stockfish');
    expect(rows[0].textContent).toContain('You won');
    expect(rows[0].textContent).toContain('12 moves');
    // A game that was abandoned is labelled as unfinished, not as a result.
    expect(rows[1].textContent).toContain('Unfinished');
    container.remove();
  });

  it('reveals the exact PGN that would be exported', () => {
    const container = render(
      <HistoryView games={[game()]} onCopy={async () => true} onDownload={noop} onDelete={noop} onClear={noop} />
    );
    const showButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Show PGN')
    ) as HTMLButtonElement;
    expect(container.querySelector('textarea')).toBeNull();
    act(() => showButton.click());
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.value).toContain('[Event "AIChess Casual Game"]');
    expect(textarea.value).toContain('1. e4 e5 1-0');
    expect(textarea.readOnly).toBe(true);
    container.remove();
  });

  it('reports a successful copy and falls back to showing the text on failure', async () => {
    const onCopy = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const container = render(
      <HistoryView games={[game()]} onCopy={onCopy} onDownload={noop} onDelete={noop} onClear={noop} />
    );
    const copyButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Copy PGN')
    ) as HTMLButtonElement;
    await act(async () => {
      copyButton.click();
    });
    expect(container.textContent).toContain('Copying was blocked');
    // ...and the PGN is opened so it can still be copied by hand.
    expect(container.querySelector('textarea')).not.toBeNull();
    await act(async () => {
      copyButton.click();
    });
    expect(container.textContent).toContain('PGN copied to the clipboard');
    container.remove();
  });

  it('offers delete and download for every row', () => {
    const onDelete = vi.fn();
    const onDownload = vi.fn();
    const container = render(
      <HistoryView
        games={[game()]}
        onCopy={async () => true}
        onDownload={onDownload}
        onDelete={onDelete}
        onClear={noop}
      />
    );
    (container.querySelector('[aria-label="Delete this game from history"]') as HTMLButtonElement).click();
    expect(onDelete).toHaveBeenCalledWith('g1');
    const download = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Download')
    ) as HTMLButtonElement;
    download.click();
    expect(onDownload).toHaveBeenCalledTimes(1);
    container.remove();
  });
});
