import { describe, it, expect } from 'vitest';
import {
  DEFAULT_THRESHOLDS,
  MATE_CP,
  classifyMove,
  computeAccuracy,
  cpFromPov,
  formatCp,
  moveAccuracy,
  scoreToCp,
  type ClassifyInput,
} from '../analysis/classification';
import type { PositionEvaluation } from '../analysis/evaluator';

function evaluation(overrides: Partial<PositionEvaluation> = {}): PositionEvaluation {
  return {
    bestMove: 'e2e4',
    score: { type: 'cp', value: 0 },
    secondBest: null,
    depth: 12,
    pv: ['e2e4'],
    ...overrides,
  };
}

function input(overrides: Partial<ClassifyInput> = {}): ClassifyInput {
  return {
    moverColor: 'w',
    cpBeforeWhite: 0,
    cpAfterWhite: 0,
    before: evaluation(),
    playedUci: 'd2d4',
    legalMoveCount: 20,
    isBookPosition: false,
    canBeCaptured: false,
    sacrificeCp: 0,
    ...overrides,
  };
}

describe('score handling', () => {
  it('keeps mate scores far away from ordinary centipawns', () => {
    expect(scoreToCp({ type: 'cp', value: 35 })).toBe(35);
    expect(scoreToCp({ type: 'mate', value: 3 })).toBeGreaterThan(2000);
    expect(scoreToCp({ type: 'mate', value: -3 })).toBeLessThan(-2000);
    // mate 0 means the side to move is already mated, so it is a lost position.
    expect(scoreToCp({ type: 'mate', value: 0 })).toBe(-MATE_CP);
  });

  it('flips the sign for the opposite point of view', () => {
    // +1.00 for White is -1.00 for Black.
    expect(cpFromPov({ type: 'cp', value: 100 }, 'w', 'w')).toBe(100);
    expect(cpFromPov({ type: 'cp', value: 100 }, 'b', 'w')).toBe(-100);
    // -0.90 for the side to move is +0.90 for White.
    expect(cpFromPov({ type: 'cp', value: -90 }, 'w', 'b')).toBe(90);
  });

  it('formats mate scores as mate, not as pawns', () => {
    expect(formatCp(50)).toBe('+0.50');
    expect(formatCp(-120)).toBe('-1.20');
    expect(formatCp(MATE_CP - 30)).toContain('mate');
  });
});

describe('classification thresholds', () => {
  const cases: [number, string][] = [
    [5, 'best'],
    [25, 'excellent'],
    [60, 'good'],
    [120, 'inaccuracy'],
    [250, 'mistake'],
    [600, 'blunder'],
  ];

  for (const [loss, expected] of cases) {
    it(`grades a ${loss}cp loss as ${expected}`, () => {
      const result = classifyMove(
        input({
          cpBeforeWhite: 40,
          cpAfterWhite: 40 - loss,
          before: evaluation({ score: { type: 'cp', value: 40 }, bestMove: 'e2e4' }),
          playedUci: 'd2d4',
        })
      );
      expect(result.classification).toBe(expected);
      expect(result.lossCp).toBe(loss);
    });
  }

  it('grades the engine move as best regardless of numbering', () => {
    const result = classifyMove(
      input({
        playedUci: 'e2e4',
        before: evaluation({ bestMove: 'e2e4', score: { type: 'cp', value: 30 } }),
        cpBeforeWhite: 30,
        cpAfterWhite: 30,
      })
    );
    expect(result.classification).toBe('best');
    expect(result.playedBest).toBe(true);
  });

  it('accepts a promotion move that differs only in the promotion piece case', () => {
    const result = classifyMove(
      input({
        playedUci: 'e7e8Q',
        before: evaluation({ bestMove: 'e7e8q' }),
        cpBeforeWhite: 100,
        cpAfterWhite: 100,
      })
    );
    expect(result.playedBest).toBe(true);
  });

  it('uses the mover point of view: Black losing ground is graded the same as White', () => {
    // Black is better (+1.00 for White means -1.00 for Black), then throws it away.
    const result = classifyMove(
      input({
        moverColor: 'b',
        cpBeforeWhite: 100,
        cpAfterWhite: 500,
        before: evaluation({ bestMove: 'd7d5', score: { type: 'cp', value: 100 } }),
        playedUci: 'g7g5',
      })
    );
    expect(result.lossCp).toBe(400);
    expect(result.classification).toBe('blunder');
  });
});

describe('special classifications', () => {
  it('marks a forced move', () => {
    const result = classifyMove(input({ legalMoveCount: 1 }));
    expect(result.classification).toBe('forced');
  });

  it('marks a book move only when the engine agrees', () => {
    const agreed = classifyMove(input({ isBookPosition: true, playedUci: 'e2e4', before: evaluation({ bestMove: 'e2e4' }) }));
    expect(agreed.classification).toBe('book');
    const diverged = classifyMove(input({ isBookPosition: true, playedUci: 'h2h4', cpBeforeWhite: 20, cpAfterWhite: -200 }));
    expect(diverged.classification).not.toBe('book');
  });

  it('identifies a missed forced mate', () => {
    const result = classifyMove(
      input({
        before: evaluation({ bestMove: 'd1h5', score: { type: 'mate', value: 2 } }),
        playedUci: 'd1d3',
        cpBeforeWhite: MATE_CP - 20,
        cpAfterWhite: 60,
      })
    );
    expect(result.classification).toBe('miss');
  });

  it('calls a missed mate that turns the game around a blunder', () => {
    const result = classifyMove(
      input({
        before: evaluation({ bestMove: 'd1h5', score: { type: 'mate', value: 2 } }),
        playedUci: 'd1d3',
        cpBeforeWhite: MATE_CP - 20,
        cpAfterWhite: -900,
      })
    );
    expect(result.classification).toBe('blunder');
  });

  it('flags a missed win in a winning position', () => {
    const result = classifyMove(
      input({
        cpBeforeWhite: 320,
        cpAfterWhite: 20,
        before: evaluation({ bestMove: 'd5e6', score: { type: 'cp', value: 320 } }),
        playedUci: 'd5c6',
      })
    );
    expect(result.classification).toBe('miss');
  });

  it('only calls a move brilliant when material is really offered and the position stays good', () => {
    const sacrifice = classifyMove(
      input({
        playedUci: 'e2e4',
        before: evaluation({ bestMove: 'e2e4' }),
        cpBeforeWhite: 340,
        cpAfterWhite: 360,
        canBeCaptured: true,
        sacrificeCp: 320,
      })
    );
    expect(sacrifice.classification).toBe('brilliant');

    const notOffered = classifyMove(
      input({ playedUci: 'e2e4', before: evaluation({ bestMove: 'e2e4' }), cpBeforeWhite: 340, cpAfterWhite: 360 })
    );
    expect(notOffered.classification).not.toBe('brilliant');

    const lostAfterwards = classifyMove(
      input({
        playedUci: 'e2e4',
        before: evaluation({ bestMove: 'e2e4' }),
        cpBeforeWhite: 100,
        cpAfterWhite: -250,
        canBeCaptured: true,
        sacrificeCp: 320,
      })
    );
    expect(lostAfterwards.classification).not.toBe('brilliant');
  });

  it('never grades the same move both brilliant and blunder', () => {
    const result = classifyMove(input({ canBeCaptured: true, sacrificeCp: 500, cpBeforeWhite: 100, cpAfterWhite: -600 }));
    expect(result.classification).not.toBe('brilliant');
  });

  it('calls a clearly best move great when the alternative is far worse', () => {
    const result = classifyMove(
      input({
        playedUci: 'e2e4',
        cpBeforeWhite: 30,
        cpAfterWhite: 30,
        before: evaluation({
          bestMove: 'e2e4',
          score: { type: 'cp', value: 30 },
          secondBest: { move: 'd2d4', score: { type: 'cp', value: -200 } },
        }),
      })
    );
    expect(result.classification).toBe('great');
    expect(result.critical).toBe(true);
  });

  it('keeps the critical flag separate from the grade', () => {
    const critical = classifyMove(
      input({
        playedUci: 'h2h4',
        cpBeforeWhite: 400,
        cpAfterWhite: -500,
        before: evaluation({
          bestMove: 'e2e4',
          score: { type: 'cp', value: 400 },
          secondBest: { move: 'd2d4', score: { type: 'cp', value: 200 } },
        }),
      })
    );
    expect(critical.classification).toBe('blunder');
    expect(critical.critical).toBe(true);
  });
});

describe('accuracy', () => {
  it('is 100% for a perfect move and falls off with the loss', () => {
    expect(moveAccuracy(0)).toBeCloseTo(100);
    expect(moveAccuracy(100)).toBeLessThan(85);
    expect(moveAccuracy(100)).toBeGreaterThan(70);
    expect(moveAccuracy(600)).toBeLessThan(30);
  });

  it('averages per side and skips book and forced moves', () => {
    const accuracy = computeAccuracy([
      { moverColor: 'w', lossCp: 0, classification: 'best' },
      { moverColor: 'b', lossCp: 0, classification: 'best' },
      { moverColor: 'w', lossCp: 300, classification: 'mistake' },
      { moverColor: 'w', lossCp: 900, classification: 'book' },
      { moverColor: 'b', lossCp: 0, classification: 'forced' },
    ]);
    expect(accuracy.sampleSize).toEqual({ white: 2, black: 1 });
    expect(accuracy.white).toBeLessThan(accuracy.black!);
  });

  it('reports null for a side with no graded moves', () => {
    const accuracy = computeAccuracy([]);
    expect(accuracy.white).toBeNull();
    expect(accuracy.black).toBeNull();
  });
});

describe('thresholds are tunable in one place', () => {
  it('a different table changes the grade without touching the UI', () => {
    const strict = { ...DEFAULT_THRESHOLDS, excellentLossCp: 5, bestLossCp: 1 };
    const result = classifyMove(
      input({ cpBeforeWhite: 0, cpAfterWhite: -20, before: evaluation({ bestMove: 'e2e4' }) }),
      strict
    );
    expect(result.classification).not.toBe('excellent');
  });
});
