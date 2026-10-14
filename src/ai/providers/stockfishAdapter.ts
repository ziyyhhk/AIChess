import type { AIMoveRequest, AIMoveResponse, AIProvider } from '../types';
import { loadStockfishWorker } from '../../engine/stockfishLoader';

export type StockfishDifficulty =
  | 'beginner'
  | 'easy'
  | 'medium'
  | 'hard'
  | 'expert'
  | 'custom';

export interface StockfishCustomOptions {
  skillLevel?: number;
  depth?: number;
  movetimeMs?: number;
}

/** Approximate target ratings (approximate). Lower levels inject weaker picks. */
export interface DifficultyProfile {
  skill: number;
  depth: number;
  movetime: number;
  limitStrength: boolean;
  elo?: number;
  randomMoveChance: number;
  weakerLineChance: number;
  targetRating: number;
}

export function difficultyToSettings(
  d: StockfishDifficulty,
  custom?: StockfishCustomOptions
): DifficultyProfile {
  switch (d) {
    case 'beginner':
      return {
        skill: 0,
        depth: 1,
        movetime: 400,
        limitStrength: true,
        elo: 600,
        randomMoveChance: 0.35,
        weakerLineChance: 0.4,
        targetRating: 600,
      };
    case 'easy':
      return {
        skill: 2,
        depth: 2,
        movetime: 600,
        limitStrength: true,
        elo: 900,
        randomMoveChance: 0.18,
        weakerLineChance: 0.35,
        targetRating: 900,
      };
    case 'medium':
      return {
        skill: 6,
        depth: 6,
        movetime: 1000,
        limitStrength: true,
        elo: 1300,
        randomMoveChance: 0.05,
        weakerLineChance: 0.2,
        targetRating: 1300,
      };
    case 'hard':
      return {
        skill: 12,
        depth: 10,
        movetime: 1400,
        limitStrength: true,
        elo: 1700,
        randomMoveChance: 0,
        weakerLineChance: 0.08,
        targetRating: 1700,
      };
    case 'expert':
      return {
        skill: 18,
        depth: 14,
        movetime: 2000,
        limitStrength: false,
        randomMoveChance: 0,
        weakerLineChance: 0,
        targetRating: 2200,
      };
    case 'custom':
      return {
        skill: custom?.skillLevel ?? 10,
        depth: custom?.depth ?? 10,
        movetime: custom?.movetimeMs ?? 1200,
        limitStrength: (custom?.skillLevel ?? 10) < 15,
        randomMoveChance: 0,
        weakerLineChance: 0,
        targetRating: 1500,
      };
    default:
      return {
        skill: 6,
        depth: 6,
        movetime: 1000,
        limitStrength: true,
        elo: 1300,
        randomMoveChance: 0.05,
        weakerLineChance: 0.2,
        targetRating: 1300,
      };
  }
}

export const DIFFICULTY_ORDER: StockfishDifficulty[] = [
  'beginner',
  'easy',
  'medium',
  'hard',
  'expert',
];

export function buildGoCommand(movetimeMs: number): string {
  return `go movetime ${Math.max(80, Math.round(movetimeMs))}`;
}

export class StockfishAdapter implements AIProvider {
  id = 'stockfish';
  name = 'Stockfish';
  requiresKey = false;

  private worker: Worker | null = null;
  private ready = false;
  private initializing: Promise<boolean> | null = null;
  private engineId = 0;
  private searchId = 0;
  private pending: {
    searchId: number;
    resolve: (v: AIMoveResponse) => void;
    reject: (e: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
    startedAt: number;
  } | null = null;

  private difficulty: StockfishDifficulty = 'medium';
  private custom: StockfishCustomOptions = {};
  private lastError: string | null = null;

  setDifficulty(d: StockfishDifficulty, custom?: StockfishCustomOptions) {
    this.difficulty = d;
    if (custom) this.custom = custom;
  }

  getLastError() {
    return this.lastError;
  }

  async init(): Promise<boolean> {
    if (this.worker && this.ready) return true;
    if (this.initializing) return this.initializing;
    this.initializing = this.doInit();
    try {
      return await this.initializing;
    } finally {
      this.initializing = null;
    }
  }

  private async doInit(): Promise<boolean> {
    this.terminateWorker();
    this.engineId++;
    const myEngine = this.engineId;

    try {
      const worker = await this.createWorker();
      if (myEngine !== this.engineId) {
        worker.terminate();
        return false;
      }
      this.worker = worker;
      this.ready = false;

      worker.onmessage = (e) => this.onMessage(String(e.data ?? ''));
      worker.onerror = (err) => {
        this.lastError = `Worker error: ${err.message || 'unknown'}`;
        this.ready = false;
        if (this.pending) {
          clearTimeout(this.pending.timeout);
          this.pending.reject(new Error(this.lastError));
          this.pending = null;
        }
      };

      worker.postMessage('uci');
      const ok = await this.waitUntil(() => this.ready, 8000);
      if (!ok) {
        this.lastError =
          'Stockfish failed to initialize (no uciok). Engine assets may be blocked or failed to load.';
        this.terminateWorker();
        return false;
      }

      worker.postMessage('isready');
      await this.sleep(50);
      return true;
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e);
      this.terminateWorker();
      return false;
    }
  }

  private async createWorker(): Promise<Worker> {
    const { worker } = await loadStockfishWorker();
    return worker;
  }

  private terminateWorker() {
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {
        /* ignore */
      }
    }
    this.worker = null;
    this.ready = false;
  }

  private onMessage(data: string) {
    if (!data) return;
    const line = data.trim();
    if (line === 'uciok' || line.startsWith('id name')) {
      this.ready = true;
      return;
    }
    if (line === 'readyok') return;

    if (line.startsWith('bestmove')) {
      const parts = line.split(/\s+/);
      const move = parts[1];
      if (!this.pending) return;
      const p = this.pending;
      if (p.searchId !== this.searchId) return;
      clearTimeout(p.timeout);
      this.pending = null;

      if (!move || move === '(none)') {
        p.reject(
          new Error(
            'Stockfish returned bestmove (none). The position may have no legal moves (checkmate/stalemate), or the engine failed to search.'
          )
        );
        return;
      }
      p.resolve({
        move: move.toLowerCase(),
        raw: line,
        thinkingMs: Date.now() - p.startedAt,
      });
    }
  }

  private sleep(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
  }

  private waitUntil(pred: () => boolean, ms: number): Promise<boolean> {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        if (pred()) return resolve(true);
        if (Date.now() - start >= ms) return resolve(false);
        setTimeout(tick, 30);
      };
      tick();
    });
  }

  async getMove(
    req: AIMoveRequest,
    _apiKey?: string,
    signal?: AbortSignal
  ): Promise<AIMoveResponse> {
    this.lastError = null;

    if (!req.legalMoves.length) {
      throw new Error('The game has ended (no legal moves). No AI move is required.');
    }

    const settings = difficultyToSettings(this.difficulty, this.custom);

    // Deliberate imperfection at low levels: sometimes pick a random legal move.
    if (settings.randomMoveChance > 0 && Math.random() < settings.randomMoveChance) {
      const pick = req.legalMoves[Math.floor(Math.random() * req.legalMoves.length)];
      return { move: pick, thinkingMs: 80 + Math.floor(Math.random() * 200) };
    }

    const ok = await this.init();
    if (!ok || !this.worker) {
      this.terminateWorker();
      const retry = await this.init();
      if (!retry || !this.worker) {
        throw new Error(
          this.lastError ||
            'Stockfish could not load its engine files. Check deployment asset paths / network and retry.'
        );
      }
    }

    this.searchId++;
    const mySearch = this.searchId;
    if (this.pending) {
      clearTimeout(this.pending.timeout);
      this.pending.reject(new Error('Search superseded'));
      this.pending = null;
    }

    try {
      this.worker!.postMessage('stop');
    } catch {
      /* ignore */
    }

    const skill = Math.max(0, Math.min(20, settings.skill));

    this.worker!.postMessage(`setoption name Skill Level value ${skill}`);
    if (settings.limitStrength && settings.elo) {
      this.worker!.postMessage('setoption name UCI_LimitStrength value true');
      this.worker!.postMessage(`setoption name UCI_Elo value ${settings.elo}`);
    } else {
      this.worker!.postMessage('setoption name UCI_LimitStrength value false');
    }

    this.worker!.postMessage('ucinewgame');
    this.worker!.postMessage(`position fen ${req.fen}`);
    this.worker!.postMessage(buildGoCommand(settings.movetime));

    const timeoutMs = Math.max(req.timeoutMs || 15000, settings.movetime + 5000);

    const engineResult = await new Promise<AIMoveResponse>((resolve, reject) => {
      const onAbort = () => {
        try {
          this.worker?.postMessage('stop');
        } catch {
          /* ignore */
        }
        if (this.pending?.searchId === mySearch) {
          clearTimeout(this.pending.timeout);
          this.pending = null;
          reject(new Error('AI request aborted'));
        }
      };
      if (signal) {
        if (signal.aborted) return onAbort();
        signal.addEventListener('abort', onAbort, { once: true });
      }

      this.pending = {
        searchId: mySearch,
        resolve: (v) => {
          const move = v.move.toLowerCase();
          if (!req.legalMoves.includes(move)) {
            reject(
              new Error(
                `Stockfish proposed illegal move "${move}" for this position. Move rejected.`
              )
            );
            return;
          }
          resolve({ ...v, move });
        },
        reject,
        startedAt: Date.now(),
        timeout: setTimeout(() => {
          if (this.pending?.searchId === mySearch) {
            this.pending = null;
            try {
              this.worker?.postMessage('stop');
            } catch {
              /* ignore */
            }
            reject(
              new Error(
                `Stockfish did not provide a move within ${timeoutMs}ms. Try again or lower difficulty.`
              )
            );
          }
        }, timeoutMs),
      };
    });

    // Sometimes pick a weaker legal move instead of engine best.
    if (settings.weakerLineChance > 0 && Math.random() < settings.weakerLineChance) {
      const others = req.legalMoves.filter((m) => m !== engineResult.move);
      if (others.length) {
        const weaker = others[Math.floor(Math.random() * Math.min(3, others.length))];
        return { ...engineResult, move: weaker };
      }
    }

    return engineResult;
  }

  dispose() {
    this.searchId++;
    if (this.pending) {
      clearTimeout(this.pending.timeout);
      this.pending = null;
    }
    this.terminateWorker();
  }
}

export const stockfishAdapter = new StockfishAdapter();
export const stockfishProvider = stockfishAdapter;
