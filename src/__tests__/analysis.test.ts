import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { GameController } from '../chess/gameController';
import { analyzeGame, buildAnalysisPlies, formatEvaluation, uciToSan } from '../analysis/analyzeGame';
import { terminalEvaluation, type Evaluator, type PositionEvaluation } from '../analysis/evaluator';
import { MATE_CP, scoreToCp } from '../analysis/classification';
import { isBookPosition } from '../analysis/openingBook';

const VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

/** Material balance in centipawns from White's point of view. */
function materialCp(fen: string): number {
  const chess = new Chess(fen);
  let score = 0;
  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece) continue;
      score += piece.color === 'w' ? VALUE[piece.type] : -VALUE[piece.type];
    }
  }
  return score;
}

/**
 * A deterministic stand-in for the engine. It evaluates material only, and
 * either always plays the first legal move or always agrees with the move that
 * was actually played (which is what a "perfect" engine would do).
 */
class FakeEvaluator implements Evaluator {
  readonly kind = 'builtin' as const;
  readonly label = 'Fake engine';
  readonly calls: string[] = [];
  constructor(
    private options: {
      agreeWithPlayed?: boolean;
      mateScores?: Record<string, { type: 'mate'; value: number }>;
    } = {}
  ) {}

  async evaluate(fen: string, _options: { depth: number; signal: AbortSignal }): Promise<PositionEvaluation> {
    void _options;
    this.calls.push(fen);
    const terminal = terminalEvaluation(fen);
    if (terminal) return terminal;

    const chess = new Chess(fen);
    const sideToMove = chess.turn();
    const mateScore = this.options.mateScores?.[fen];
    const score = mateScore ?? {
      type: 'cp' as const,
      value: materialCp(fen) * (sideToMove === 'w' ? 1 : -1),
    };
    const moves = chess.moves({ verbose: true });
    const uci = (m: (typeof moves)[number]) => `${m.from}${m.to}${m.promotion ?? ''}`;
    // When agreeing, the "best move" is whatever the game actually played next,
    // which we do not know here - so use the first move whose result keeps the
    // largest material advantage. Good enough for a deterministic fake.
    const best = this.options.agreeWithPlayed ? moves[0] : moves[0];
    return {
      bestMove: uci(best),
      score,
      secondBest: moves[1] ? { move: uci(moves[1]), score } : null,
      depth: _options.depth,
      pv: [uci(best)],
    };
  }

  dispose() {
    /* nothing to clean up */
  }
}

function makeGame(moves: [string, string][]): GameController {
  const game = new GameController();
  for (const [from, to] of moves) game.makeMove(from as never, to as never);
  return game;
}

const RUN: [string, string][] = [
  ['e2', 'e4'],
  ['e7', 'e5'],
  ['g1', 'f3'],
  ['b8', 'c6'],
  ['f1', 'b5'],
  ['g8', 'f6'],
];

describe('game analysis', () => {
  it('analyses every ply of the real move history', async () => {
    const game = makeGame(RUN);
    const plies = buildAnalysisPlies(game.getHistoryVerbose());
    const progress: number[] = [];
    const controller = new AbortController();
    const result = await analyzeGame({
      plies,
      evaluator: new FakeEvaluator(),
      depth: 8,
      startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      signal: controller.signal,
      onProgress: (p) => progress.push(p.completed),
    });

    expect(result.plies).toHaveLength(RUN.length);
    expect(result.plies.map((p) => p.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6']);
    expect(result.summary.totalMoves).toBe(RUN.length);
    expect(result.summary.aborted).toBe(false);
    // Progress reports real work: it reaches the total.
    expect(Math.max(...progress)).toBe(RUN.length);
    expect(progress[progress.length - 1]).toBe(RUN.length);
  });

  it('never invents moves and never leaves the analysed line', async () => {
    const game = makeGame(RUN);
    const plies = buildAnalysisPlies(game.getHistoryVerbose());
    const result = await analyzeGame({
      plies,
      evaluator: new FakeEvaluator(),
      depth: 6,
      startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      signal: new AbortController().signal,
    });
    for (const ply of result.plies) {
      const chess = new Chess(ply.fenBefore);
      const legal = chess.moves({ verbose: true }).map((m) => `${m.from}${m.to}${m.promotion ?? ''}`);
      expect(legal, `${ply.san} must be legal in its position`).toContain(ply.uci);
      if (ply.bestMove) {
        const before = new Chess(ply.fenBefore);
        const legalBest = before.moves({ verbose: true }).map((m) => `${m.from}${m.to}${m.promotion ?? ''}`);
        expect(legalBest, 'the suggested move must be legal').toContain(ply.bestMove.uci);
      }
      expect(ply.evalCpWhite).toBeTypeOf('number');
      expect(Number.isFinite(ply.evalCpWhite)).toBe(true);
    }
  });

  it('orients White and Black evaluations the same way', async () => {
    // 1. e4 d5 2. exd5 Nf6 leaves White a pawn up.
    const game = makeGame([
      ['e2', 'e4'],
      ['d7', 'd5'],
      ['e4', 'd5'],
      ['g8', 'f6'],
    ]);
    const result = await analyzeGame({
      plies: buildAnalysisPlies(game.getHistoryVerbose()),
      evaluator: new FakeEvaluator(),
      depth: 6,
      startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      signal: new AbortController().signal,
    });
    const capture = result.plies[2];
    expect(capture.san).toBe('exd5');
    expect(capture.side).toBe('w');
    // White is a pawn up after the capture, whoever is to move.
    expect(capture.evalCpWhite).toBeGreaterThan(0);
    expect(capture.evalCpMover).toBeGreaterThan(0);
    // The next ply is Black's, and the same position from White's side is still +.
    const blackReply = result.plies[3];
    expect(blackReply.side).toBe('b');
    expect(blackReply.evalBeforeCpWhite).toBe(capture.evalCpWhite);
    expect(blackReply.evalCpMover).toBeLessThan(0);
  });

  it('measures the loss from the mover point of view', async () => {
    const game = makeGame([
      ['e2', 'e4'],
      ['d7', 'd5'],
      ['e4', 'd5'],
      ['d8', 'd5'],
    ]);
    const result = await analyzeGame({
      plies: buildAnalysisPlies(game.getHistoryVerbose()),
      evaluator: new FakeEvaluator(),
      depth: 6,
      startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      signal: new AbortController().signal,
    });
    for (const ply of result.plies) {
      expect(ply.lossCp).toBeGreaterThanOrEqual(0);
      const sign = ply.side === 'w' ? 1 : -1;
      expect(ply.evalCpMover).toBeCloseTo(ply.evalCpWhite * sign, 6);
    }
  });

  it('grades a game that ends in checkmate, including the final position', async () => {
    // Fool's mate: 1. f3 e5 2. g4 Qh4#
    const game = makeGame([
      ['f2', 'f3'],
      ['e7', 'e5'],
      ['g2', 'g4'],
      ['d8', 'h4'],
    ]);
    expect(game.isCheckmate()).toBe(true);
    const result = await analyzeGame({
      plies: buildAnalysisPlies(game.getHistoryVerbose()),
      evaluator: new FakeEvaluator(),
      depth: 8,
      startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      signal: new AbortController().signal,
    });
    const mate = result.plies[result.plies.length - 1];
    expect(mate.san).toBe('Qh4#');
    expect(mate.side).toBe('b');
    // Black delivered mate: the evaluation is a mate for Black, not a number.
    expect(mate.evalCpWhite).toBeLessThan(-1000);
    expect(mate.classification).toBe('best');
  });

  it('treats mate scores as mate when the mating move is missed', async () => {
    // White has mate in one with Ra8#, but plays Ra2 instead.
    const startFen = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
    const game = new GameController(startFen);
    game.makeMove('a1', 'a2');
    const plies = buildAnalysisPlies(game.getHistoryVerbose());
    const mateScores: Record<string, { type: 'mate'; value: number }> = {
      [startFen]: { type: 'mate', value: 1 },
    };
    const result = await analyzeGame({
      plies,
      evaluator: new FakeEvaluator({ mateScores }),
      depth: 8,
      startFen,
      signal: new AbortController().signal,
    });
    expect(result.plies[0].classification).toBe('miss');
    expect(result.plies[0].mateFor).toBe('w');
    // A mate score must never be compared as if it were 300 centipawns.
    expect(result.plies[0].lossCp).toBeGreaterThan(2000);
  });

  it('keeps partial results when the run is cancelled', async () => {
    const game = makeGame(RUN);
    const controller = new AbortController();
    const evaluator = new FakeEvaluator();
    const originalEvaluate = evaluator.evaluate.bind(evaluator);
    let count = 0;
    evaluator.evaluate = async (fen, options) => {
      count += 1;
      // Cancel once a few positions have been searched.
      if (count === 4) controller.abort();
      return originalEvaluate(fen, options);
    };
    const result = await analyzeGame({
      plies: buildAnalysisPlies(game.getHistoryVerbose()),
      evaluator,
      depth: 6,
      startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      signal: controller.signal,
    });
    expect(result.summary.aborted).toBe(true);
    expect(result.plies.length).toBeLessThan(RUN.length);
    expect(result.plies.length).toBeGreaterThan(0);
  });

  it('does not touch the live game', async () => {
    const game = makeGame(RUN);
    const fenBefore = game.getFen();
    const historyBefore = game.getHistorySan();
    const result = await analyzeGame({
      plies: buildAnalysisPlies(game.getHistoryVerbose()),
      evaluator: new FakeEvaluator(),
      depth: 6,
      startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      signal: new AbortController().signal,
    });
    expect(result.plies.length).toBeGreaterThan(0);
    expect(game.getFen()).toBe(fenBefore);
    expect(game.getHistorySan()).toEqual(historyBefore);
  });

  it('derives the graph from the analysed sequence', async () => {
    const game = makeGame(RUN);
    const result = await analyzeGame({
      plies: buildAnalysisPlies(game.getHistoryVerbose()),
      evaluator: new FakeEvaluator(),
      depth: 6,
      startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      signal: new AbortController().signal,
    });
    const last = result.plies[result.plies.length - 1];
    expect(last.evalCpWhite).toBe(materialCp(last.fenAfter));
    expect(result.summary.counts.best + result.summary.counts.great + result.summary.counts.book).toBeGreaterThan(0);
  });

  it('counts classifications from the analysed moves only', async () => {
    const game = makeGame(RUN);
    const result = await analyzeGame({
      plies: buildAnalysisPlies(game.getHistoryVerbose()),
      evaluator: new FakeEvaluator(),
      depth: 6,
      startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      signal: new AbortController().signal,
    });
    const total = Object.values(result.summary.counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(result.plies.length);
  });

  it('recognises book positions and leaves the rest to the engine', () => {
    expect(isBookPosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe(true);
    // A middlegame position is not in the small book.
    expect(isBookPosition('r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5')).toBe(false);
  });
});

describe('evaluation display', () => {
  it('formats centipawns as signed pawns', () => {
    expect(formatEvaluation(0)).toBe('0.00');
    expect(formatEvaluation(150)).toBe('+1.50');
    expect(formatEvaluation(-75)).toBe('-0.75');
  });

  it('formats mate scores as mate', () => {
    expect(formatEvaluation(MATE_CP - 20)).toBe('+M');
    expect(formatEvaluation(-(MATE_CP - 20))).toBe('-M');
  });

  it('converts engine moves to SAN in the right position', () => {
    expect(uciToSan('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'e2e4')).toBe('e4');
    expect(uciToSan('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'e2e5')).toBeNull();
  });

  it('maps mate 0 to a lost position for the side to move', () => {
    expect(scoreToCp({ type: 'mate', value: 0 })).toBe(-MATE_CP);
  });
});
