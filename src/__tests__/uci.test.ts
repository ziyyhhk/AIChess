import { describe, it, expect } from 'vitest';
import { parseInfoLine } from '../engine/uci';

describe('UCI info parsing', () => {
  it('reads depth, score and the principal variation', () => {
    const info = parseInfoLine(
      'info depth 12 seldepth 18 multipv 1 score cp 34 nodes 128000 nps 900000 time 142 pv e2e4 e7e5 g1f3'
    );
    expect(info).not.toBeNull();
    expect(info!.depth).toBe(12);
    expect(info!.multipv).toBe(1);
    expect(info!.score).toEqual({ type: 'cp', value: 34 });
    expect(info!.pv[0]).toBe('e2e4');
    expect(info!.pv).toHaveLength(3);
  });

  it('keeps mate scores as mate, never as centipawns', () => {
    const info = parseInfoLine('info depth 9 score mate -3 pv h4f2');
    expect(info!.score.type).toBe('mate');
    expect(info!.score.value).toBe(-3);
  });

  it('reads negative centipawn scores', () => {
    const info = parseInfoLine('info depth 6 score cp -220 pv d8d5');
    expect(info!.score).toEqual({ type: 'cp', value: -220 });
  });

  it('tracks the MultiPV index', () => {
    const info = parseInfoLine('info depth 14 multipv 2 score cp 12 pv d2d4 d7d5');
    expect(info!.multipv).toBe(2);
  });

  it('ignores lines that carry no evaluation', () => {
    expect(parseInfoLine('info string NNUE evaluation using nn-123.nnue')).toBeNull();
    expect(parseInfoLine('bestmove e2e4 ponder e7e5')).toBeNull();
    expect(parseInfoLine('readyok')).toBeNull();
    expect(parseInfoLine('info depth 10 nodes 200')).toBeNull();
  });

  it('handles the node-speed fields engines add', () => {
    const info = parseInfoLine('info depth 8 score cp 0 lowerbound pv c2c4');
    expect(info!.score.value).toBe(0);
  });
});
