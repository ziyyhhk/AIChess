/**
 * The thing that evaluates positions for the analysis view.
 *
 * Two implementations exist:
 *   - Stockfish: a dedicated worker, completely separate from the one playing
 *     the game, so analysing can never interrupt or corrupt gameplay.
 *   - A built-in mini engine (see engine/miniEngine.ts) used only when Stockfish
 *     is unavailable. It is labelled as such everywhere its numbers appear.
 */
import { Chess } from 'chess.js';
import { loadStockfishWorker, STOCKFISH_CDN_URL } from '../engine/stockfishLoader';
import { UciEngine, type Score } from '../engine/uci';
import { searchWithMiniEngine } from '../engine/miniEngine';

export interface EngineLine {
  move: string;
  score: Score;
}

export interface PositionEvaluation {
  /** Best move in UCI coordinates for the position that was searched. */
  bestMove: string;
  /** Score from the side-to-move's point of view, exactly like UCI reports it. */
  score: Score;
  /** Second best line, when the engine supports MultiPV (used for "critical" spots). */
  secondBest: EngineLine | null;
  depth: number;
  pv: string[];
}

export interface EvaluateOptions {
  depth: number;
  signal: AbortSignal;
  /** 2 when the caller wants the second-best line as well. */
  multiPv?: number;
}

/**
 * A finished position has no move to search. UCI reports `mate 0` when the side
 * to move is checkmated; a draw is 0.00. Handling this here keeps a game that
 * ended in checkmate analysable instead of failing on its last position.
 */
export function terminalEvaluation(fen: string): PositionEvaluation | null {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return null;
  }
  const noMoves = chess.moves().length === 0;
  if (chess.isCheckmate()) {
    return { bestMove: '', score: { type: 'mate', value: 0 }, secondBest: null, depth: 0, pv: [] };
  }
  if (noMoves && (chess.isDraw() || chess.isStalemate())) {
    return { bestMove: '', score: { type: 'cp', value: 0 }, secondBest: null, depth: 0, pv: [] };
  }
  return null;
}

export interface Evaluator {
  readonly kind: 'stockfish' | 'builtin';
  readonly label: string;
  evaluate(fen: string, options: EvaluateOptions): Promise<PositionEvaluation>;
  dispose(): void;
}

/** Stockfish over UCI, running in its own worker. */
class StockfishEvaluator implements Evaluator {
  readonly kind = 'stockfish' as const;
  readonly label: string;
  private engine: UciEngine;
  private started = false;

  constructor(engine: UciEngine, label: string) {
    this.engine = engine;
    this.label = label;
  }

  static async create(): Promise<StockfishEvaluator> {
    const loaded = await loadStockfishWorker();
    const engine = new UciEngine(loaded.worker);
    await engine.init();
    const label =
      loaded.source === 'local'
        ? 'Stockfish (bundled build)'
        : 'Stockfish 10 (jsDelivr build)';
    return new StockfishEvaluator(engine, label);
  }

  async evaluate(fen: string, options: EvaluateOptions): Promise<PositionEvaluation> {
    const terminal = terminalEvaluation(fen);
    if (terminal) return terminal;
    if (!this.started) {
      await this.engine.newGame();
      this.started = true;
    }
    await this.engine.setPosition(fen);
    const result = await this.engine.search({
      depth: options.depth,
      multiPv: options.multiPv ?? 1,
      signal: options.signal,
    });
    const best = result.info.find((i) => i.multipv === 1) ?? result.best;
    const second = result.info.find((i) => i.multipv === 2) ?? null;
    if (!best) {
      throw new Error(`Stockfish returned no evaluation for ${fen}`);
    }
    return {
      bestMove: best.pv[0] ?? result.move,
      score: best.score,
      secondBest: second ? { move: second.pv[0] ?? '', score: second.score } : null,
      depth: best.depth || result.depth,
      pv: best.pv,
    };
  }

  dispose() {
    this.engine.dispose();
  }
}

/** The offline fallback: a real search, but far weaker than Stockfish. */
class BuiltinEvaluator implements Evaluator {
  readonly kind = 'builtin' as const;
  readonly label = 'AIChess built-in engine (offline fallback, limited strength)';
  private depth: number;
  private timeBudgetMs: number;

  constructor(depth: number, timeBudgetMs: number) {
    this.depth = Math.max(1, Math.min(4, Math.round(depth)));
    this.timeBudgetMs = timeBudgetMs;
  }

  async evaluate(fen: string, options: EvaluateOptions): Promise<PositionEvaluation> {
    const terminal = terminalEvaluation(fen);
    if (terminal) return terminal;
    if (options.signal.aborted) throw new Error('Analysis cancelled');
    // Yield to the event loop first so a long analysis never blocks the UI for
    // more than one position at a time.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const result = searchWithMiniEngine(fen, {
      maxDepth: Math.min(this.depth, Math.max(1, Math.round(options.depth / 4))),
      timeBudgetMs: this.timeBudgetMs,
    });
    if (!result.move) throw new Error('The built-in engine found no legal move');
    return {
      bestMove: result.move,
      score: result.score,
      secondBest: null,
      depth: result.depth,
      pv: result.pv,
    };
  }

  dispose() {
    /* nothing to release */
  }
}

export interface CreateEvaluatorResult {
  evaluator: Evaluator;
  /** Set when Stockfish could not be loaded; shown to the user. */
  warning?: string;
}

/**
 * Build the strongest available evaluator. Never throws for a missing engine -
 * analysis continues with the built-in engine and the caller shows the warning.
 */
export async function createEvaluator(): Promise<CreateEvaluatorResult> {
  try {
    const evaluator = await StockfishEvaluator.create();
    return { evaluator };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      evaluator: new BuiltinEvaluator(3, 140),
      warning: `${reason} Analysing with the bundled fallback engine instead - results are real, but much weaker than Stockfish.`,
    };
  }
}

export { STOCKFISH_CDN_URL };
