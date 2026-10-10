import type { AIMoveRequest, AIMoveResponse, AIProvider } from '../types';

export class StockfishAdapter implements AIProvider {
  id = 'stockfish';
  name = 'Stockfish';
  requiresKey = false;

  private worker: Worker | null = null;
  private ready = false;
  private pending: {
    resolve: (v: AIMoveResponse) => void;
    reject: (e: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  } | null = null;

  async init(): Promise<boolean> {
    if (this.worker) return this.ready;
    try {
      const base = import.meta.env.BASE_URL || '/';
      const url = `${base}engines/stockfish.js`;
      this.worker = new Worker(url);
      this.worker.onmessage = (e) => this.onMessage(e.data);
      this.worker.onerror = () => { this.ready = false; };
      this.worker.postMessage('uci');
      await new Promise<void>((resolve) => {
        const t = setTimeout(() => resolve(), 2000);
        const check = setInterval(() => {
          if (this.ready) { clearInterval(check); clearTimeout(t); resolve(); }
        }, 50);
      });
      return this.ready;
    } catch {
      this.worker = null;
      this.ready = false;
      return false;
    }
  }

  private onMessage(data: string) {
    if (typeof data !== 'string') return;
    if (data === 'uciok' || data.startsWith('id name')) {
      this.ready = true;
      return;
    }
    if (data.startsWith('bestmove')) {
      const parts = data.split(/\s+/);
      const move = parts[1];
      if (this.pending && move && move !== '(none)') {
        clearTimeout(this.pending.timeout);
        this.pending.resolve({ move, raw: data });
        this.pending = null;
      } else if (this.pending) {
        clearTimeout(this.pending.timeout);
        this.pending.reject(new Error('Stockfish returned no move'));
        this.pending = null;
      }
    }
  }

  async getMove(req: AIMoveRequest, _apiKey?: string, signal?: AbortSignal): Promise<AIMoveResponse> {
    const ok = await this.init();
    if (ok && this.worker) {
      return new Promise((resolve, reject) => {
        if (signal?.aborted) { reject(new Error('Aborted')); return; }
        const timeoutMs = req.timeoutMs || 5000;
        const timeout = setTimeout(() => {
          this.pending = null;
          resolve(this.randomLegal(req));
        }, timeoutMs);
        this.pending = { resolve, reject, timeout };
        const depth = req.difficulty ? Math.min(20, Math.max(1, req.difficulty)) : 12;
        this.worker!.postMessage('ucinewgame');
        this.worker!.postMessage(`position fen ${req.fen}`);
        this.worker!.postMessage(`go depth ${depth}`);
        signal?.addEventListener('abort', () => {
          clearTimeout(timeout);
          this.pending = null;
          reject(new Error('Aborted'));
        });
      });
    }
    return this.randomLegal(req);
  }

  private randomLegal(req: AIMoveRequest): AIMoveResponse {
    if (req.legalMoves.length === 0) throw new Error('No legal moves');
    const move = req.legalMoves[Math.floor(Math.random() * req.legalMoves.length)];
    return { move, raw: 'fallback-random' };
  }

  dispose() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.ready = false;
    }
  }
}

export const stockfishProvider = new StockfishAdapter();
