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
import { getCachedEval, setCachedEval } from './evalCache';

export interface EngineLine {
  move: string;
  score: Score;
}

export interface PositionEvaluation {
  bestMove: string;
  score: Score;
  secondBest: EngineLine | null;
  depth: number;
  pv: string[];
}

export interface EvaluateOptions {
  depth: number;
  signal: AbortSignal;
  multiPv?: number;
}

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
    const multiPv = options.multiPv ?? 1;
    const cached = getCachedEval(fen, options.depth, multiPv);
    if (cached) return cached;
    if (!this.started) {
      await this.engine.newGame();
      this.started = true;
    }
    await this.engine.setPosition(fen);
    const result = await this.engine.search({
      depth: options.depth,
      multiPv,
      signal: options.signal,
    });
    const best = result.info.find((i) => i.multipv === 1) ?? result.best;
    const second = result.info.find((i) => i.multipv === 2) ?? null;
    if (!best) {
      throw new Error(`Stockfish returned no evaluation for ${fen}`);
    }
    const evaluation = {
      bestMove: best.pv[0] ?? result.move,
      score: best.score,
      secondBest: second ? { move: second.pv[0] ?? '', score: second.score } : null,
      depth: best.depth || result.depth,
      pv: best.pv,
    };
    setCachedEval(fen, multiPv, evaluation);
    return evaluation;
  }

  dispose() {
    this.engine.dispose();
  }
}

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
  warning?: string;
}

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
