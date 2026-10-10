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
