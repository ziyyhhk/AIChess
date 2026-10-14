import { describe, it, expect } from 'vitest';
import { GameController } from '../chess/gameController';
import { exportPgn, pgnDate, resultToPgnToken } from '../chess/pgn';

describe('PGN export', () => {
  it('exports headers and SAN for a short game', () => {
    const g = new GameController();
    g.makeMove('e2', 'e4');
    g.makeMove('e7', 'e5');
    g.makeMove('g1', 'f3');
    const pgn = exportPgn(g, {
      white: 'Player',
      black: 'Stockfish',
      event: 'Casual Game',
    });
    expect(pgn).toContain('[Event "Casual Game"]');
    expect(pgn).toContain('[Site "AIChess"]');
    expect(pgn).toContain('[White "Player"]');
    expect(pgn).toContain('[Black "Stockfish"]');
    expect(pgn).toContain('[Result "*"]');
    expect(pgn).toMatch(/1\.\s*e4\s+e5/);
    expect(pgn).toMatch(/2\.\s*Nf3/);
    expect(pgn.trim().endsWith('*')).toBe(true);
  });

  it('uses correct result token on checkmate', () => {
    const g = new GameController();
    g.makeMove('f2', 'f3');
    g.makeMove('e7', 'e5');
    g.makeMove('g2', 'g4');
    g.makeMove('d8', 'h4');
    expect(g.isCheckmate()).toBe(true);
    const token = resultToPgnToken(g.getResult(), true);
    expect(token).toBe('0-1');
    const pgn = exportPgn(g, { white: 'Player', black: 'AI' });
    expect(pgn).toContain('[Result "0-1"]');
    expect(pgn).toMatch(/0-1\s*$/);
  });

  it('exports castling as O-O', () => {
    const g = new GameController();
    g.makeMove('e2', 'e4');
    g.makeMove('e7', 'e5');
    g.makeMove('g1', 'f3');
    g.makeMove('b8', 'c6');
    g.makeMove('f1', 'c4');
    g.makeMove('g8', 'f6');
    g.makeMove('e1', 'g1');
    const pgn = exportPgn(g);
    expect(pgn).toMatch(/O-O/);
  });

  it('round-trips via loadPgn', () => {
    const g = new GameController();
    g.makeMove('e2', 'e4');
    g.makeMove('d7', 'd5');
    g.makeMove('e4', 'd5');
    g.makeMove('d8', 'd5');
    const pgn = exportPgn(g, { result: '*' });
    const g2 = new GameController();
    expect(g2.loadPgn(pgn)).toBe(true);
    expect(g2.getFen().split(' ')[0]).toBe(g.getFen().split(' ')[0]);
  });

  it('formats date as YYYY.MM.DD', () => {
    const d = pgnDate(new Date('2026-10-10T12:00:00Z'));
    expect(d).toBe('2026.10.10');
  });

  it('escapes quotes in headers', () => {
    const g = new GameController();
    const pgn = exportPgn(g, { white: 'Player "X"' });
    expect(pgn).toContain('[White "Player \\"X\\""]');
  });
});

describe('PGN completeness', () => {
  it('writes SAN for a promotion', () => {
    const g = new GameController('4k3/3P4/8/8/8/8/8/4K3 w - - 0 1');
    expect(g.makeMove('d7', 'd8', 'q')).not.toBeNull();
    const pgn = exportPgn(g, { result: '*' });
    expect(pgn).toContain('d8=Q+');
  });

  it('writes SAN for an en passant capture', () => {
    const g = new GameController('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
    g.makeMove('e5', 'd6');
    const pgn = exportPgn(g, { result: '*' });
    expect(pgn).toContain('exd6');
  });

  it('marks a checking move with +', () => {
    const g = new GameController('4k3/8/8/8/8/8/8/4KR2 w - - 0 1');
    g.makeMove('f1', 'f8');
    const pgn = exportPgn(g, { result: '*' });
    expect(pgn).toMatch(/Rf8\+/);
  });

  it('drops undone moves from the export', () => {
    const g = new GameController();
    g.makeMove('e2', 'e4');
    g.makeMove('e7', 'e5');
    g.undo();
    const pgn = exportPgn(g, { result: '*' });
    expect(pgn).toContain('e4');
    expect(pgn).not.toContain('e5');
  });

  it('exports an empty game after a restart without old moves', () => {
    const g = new GameController();
    g.makeMove('e2', 'e4');
    g.makeMove('e7', 'e5');
    g.reset();
    const pgn = exportPgn(g, { result: '*' });
    expect(pgn).not.toMatch(/e4|e5/);
    expect(pgn.trim().endsWith('*')).toBe(true);
  });

  it('round-trips a promotion game through chess.js', () => {
    const g = new GameController('4k3/3P4/8/8/8/8/8/4K3 w - - 0 1');
    g.makeMove('d7', 'd8', 'q');
    const pgn = exportPgn(g, { result: '*' });
    const back = new GameController();
    expect(back.loadPgn(pgn)).toBe(true);
    expect(back.getHistorySan()).toEqual(['d8=Q+']);
    expect(back.getFen().split(' ')[0]).toBe(g.getFen().split(' ')[0]);
  });

  it('includes every header a PGN reader expects', () => {
    const g = new GameController();
    const pgn = exportPgn(g, { white: 'You', black: 'Stockfish', result: '*' });
    for (const header of ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result']) {
      expect(pgn).toMatch(new RegExp(`\\[${header} `));
    }
  });
});
