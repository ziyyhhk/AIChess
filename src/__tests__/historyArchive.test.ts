import { describe, it, expect } from 'vitest';
import {
  HISTORY_KEY,
  MAX_ARCHIVED_GAMES,
  clearArchive,
  deleteArchivedGame,
  describeResult,
  formatPlayed,
  loadArchive,
  saveArchivedGame,
  shouldArchive,
  type ArchivedGame,
  type StorageLike,
} from '../history/archive';

function makeStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

function entry(over: Partial<ArchivedGame> = {}): ArchivedGame {
  return {
    id: 'g1',
    startedAt: '2026-01-01T10:00:00.000Z',
    finishedAt: '2026-01-01T10:05:00.000Z',
    white: 'You',
    black: 'Stockfish',
    result: '1-0',
    plies: 20,
    playerColor: 'w',
    pgn: '[Event "AIChess"]\n\n1. e4 e5 1-0\n',
    unfinished: false,
    ...over,
  };
}

describe('history archive', () => {
  it('starts empty and survives unreadable storage', () => {
    expect(loadArchive(makeStorage())).toEqual([]);
    expect(loadArchive(null)).toEqual([]);
    expect(loadArchive(makeStorage({ [HISTORY_KEY]: 'not json' }))).toEqual([]);
    expect(loadArchive(makeStorage({ [HISTORY_KEY]: '{"nope":1}' }))).toEqual([]);
    // Entries that are not games are dropped, good ones stay.
    const mixed = makeStorage({
      [HISTORY_KEY]: JSON.stringify([{ id: 'bad' }, entry({ id: 'ok' })]),
    });
    expect(loadArchive(mixed).map((g) => g.id)).toEqual(['ok']);
  });

  it('keeps the newest game first', () => {
    const storage = makeStorage();
    saveArchivedGame(entry({ id: 'a' }), storage);
    const list = saveArchivedGame(entry({ id: 'b' }), storage);
    expect(list.map((g) => g.id)).toEqual(['b', 'a']);
    expect(loadArchive(storage).map((g) => g.id)).toEqual(['b', 'a']);
  });

  it('never stores the same game twice', () => {
    const storage = makeStorage();
    saveArchivedGame(entry({ id: 'a' }), storage);
    const list = saveArchivedGame(entry({ id: 'a', result: '0-1' }), storage);
    expect(list).toHaveLength(1);
    expect(list[0].result).toBe('0-1');
  });

  it('caps the archive', () => {
    const storage = makeStorage();
    for (let i = 0; i < MAX_ARCHIVED_GAMES + 5; i++) saveArchivedGame(entry({ id: `g${i}` }), storage);
    const list = loadArchive(storage);
    expect(list).toHaveLength(MAX_ARCHIVED_GAMES);
    expect(list[0].id).toBe(`g${MAX_ARCHIVED_GAMES + 4}`);
  });

  it('deletes one game or all of them', () => {
    const storage = makeStorage();
    saveArchivedGame(entry({ id: 'a' }), storage);
    saveArchivedGame(entry({ id: 'b' }), storage);
    expect(deleteArchivedGame('a', storage).map((g) => g.id)).toEqual(['b']);
    expect(loadArchive(storage).map((g) => g.id)).toEqual(['b']);
    expect(clearArchive(storage)).toEqual([]);
    expect(loadArchive(storage)).toEqual([]);
  });

  it('does not throw when storage refuses to write', () => {
    const hostile: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => undefined,
    };
    const list = saveArchivedGame(entry(), hostile);
    expect(list).toHaveLength(1);
  });

  it('archives any real game, not a one-move accident', () => {
    expect(shouldArchive(0)).toBe(false);
    expect(shouldArchive(1)).toBe(false);
    expect(shouldArchive(2)).toBe(true);
  });
});

describe('history labels', () => {
  it('describes the result from the human player’s point of view', () => {
    expect(describeResult(entry({ result: '1-0', playerColor: 'w' }))).toBe('You won');
    expect(describeResult(entry({ result: '1-0', playerColor: 'b' }))).toBe('You lost');
    expect(describeResult(entry({ result: '0-1', playerColor: 'b' }))).toBe('You won');
    expect(describeResult(entry({ result: '1/2-1/2' }))).toBe('Draw');
    expect(describeResult(entry({ result: '*', unfinished: true }))).toBe('Unfinished');
  });

  it('formats a timestamp and falls back to the raw string', () => {
    expect(formatPlayed('2026-01-02T03:04:05.000Z').length).toBeGreaterThan(4);
    expect(formatPlayed('not a date')).toBe('not a date');
  });
});
