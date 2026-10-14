/**
 * Pool of single-threaded Stockfish evaluators for parallel analysis.
 * Multi-threaded Stockfish needs SharedArrayBuffer / COOP-COEP which GitHub
 * Pages cannot set, so we only run multiple single-threaded workers.
 */
import { createEvaluator, type Evaluator } from './evaluator';

export function poolSize(): number {
  const hw =
    typeof navigator !== 'undefined' && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 2;
  return Math.max(1, Math.min(4, hw));
}

export class EvaluatorPool {
  private workers: Evaluator[] = [];
  private free: Evaluator[] = [];
  private waiters: Array<(e: Evaluator) => void> = [];
  private disposed = false;
  warning: string | null = null;
  label = 'Stockfish';

  static async create(size = poolSize()): Promise<EvaluatorPool> {
    const pool = new EvaluatorPool();
    const n = Math.max(1, size);
    const results = await Promise.all(
      Array.from({ length: n }, () => createEvaluator())
    );
    for (const r of results) {
      pool.workers.push(r.evaluator);
      pool.free.push(r.evaluator);
      if (r.warning) pool.warning = r.warning;
      pool.label = r.evaluator.label;
    }
    return pool;
  }

  async withEvaluator<T>(fn: (e: Evaluator) => Promise<T>): Promise<T> {
    if (this.disposed) throw new Error('Evaluator pool disposed');
    const eng = await this.acquire();
    try {
      return await fn(eng);
    } finally {
      this.release(eng);
    }
  }

  private acquire(): Promise<Evaluator> {
    if (this.free.length) return Promise.resolve(this.free.pop()!);
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  private release(e: Evaluator) {
    if (this.disposed) {
      e.dispose();
      return;
    }
    const waiter = this.waiters.shift();
    if (waiter) waiter(e);
    else this.free.push(e);
  }

  dispose() {
    this.disposed = true;
    this.waiters = [];
    for (const e of this.workers) e.dispose();
    this.workers = [];
    this.free = [];
  }
}
