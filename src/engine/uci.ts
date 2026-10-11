/**
 * A small UCI client for a Stockfish worker.
 *
 * One instance drives exactly one worker, and one search at a time. Commands
 * are serialised through an internal queue so a second request can never be
 * interleaved into an ongoing search - the bug that makes engines return a
 * `bestmove` that belongs to another position.
 */

export interface Score {
  type: 'cp' | 'mate';
  /** Centipawns, or moves-to-mate (negative when the side to move is mated). */
  value: number;
}

export interface SearchInfo {
  depth: number;
  multipv: number;
  score: Score;
  pv: string[];
}

export interface SearchResult {
  move: string;
  info: SearchInfo[];
  best: SearchInfo | null;
  depth: number;
}

export interface SearchOptions {
  /** Fixed depth. Ignored when `movetimeMs` is given. */
  depth?: number;
  movetimeMs?: number;
  /** Ask the engine for the best N lines (used by the analysis view). */
  multiPv?: number;
  signal?: AbortSignal;
  onInfo?: (info: SearchInfo) => void;
}

const INFO_RE =
  /^info\s(?=.*\bdepth\b)(?:.*?\bdepth\s(\d+))?(?:.*?\bmultipv\s(\d+))?(?:.*?\bscore\s(cp|mate)\s(-?\d+))?(?:.*?\bpv\s(.+))?$/;

export function parseInfoLine(line: string): SearchInfo | null {
  if (!line.startsWith('info ')) return null;
  const match = INFO_RE.exec(line);
  if (!match) return null;
  const depth = match[1] ? parseInt(match[1], 10) : 0;
  const multipv = match[2] ? parseInt(match[2], 10) : 1;
  const scoreType = match[3] as 'cp' | 'mate' | undefined;
  const scoreValue = match[4] !== undefined ? parseInt(match[4], 10) : undefined;
  const pv = match[5] ? match[5].trim().split(/\s+/).filter(Boolean) : [];
  if (!scoreType || scoreValue === undefined || !pv.length) return null;
  return { depth, multipv, score: { type: scoreType, value: scoreValue }, pv };
}

export class UciError extends Error {}

export class UciEngine {
  private worker: Worker;
  private listeners = new Set<(line: string) => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private searching = false;
  private disposed = false;
  private idName = 'Stockfish';
  onLog?: (line: string) => void;

  constructor(worker: Worker) {
    this.worker = worker;
    this.worker.onmessage = (event: MessageEvent) => {
      const text = String(event.data ?? '');
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        this.onLog?.(trimmed);
        for (const listener of Array.from(this.listeners)) listener(trimmed);
      }
    };
    this.worker.onerror = (event) => {
      this.onLog?.(`worker error: ${(event as ErrorEvent).message || 'unknown'}`);
    };
  }

  get engineName() {
    return this.idName;
  }

  isDisposed() {
    return this.disposed;
  }

  private send(command: string) {
    if (this.disposed) return;
    this.worker.postMessage(command);
  }

  private once(predicate: (line: string) => boolean, timeoutMs: number, what: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.delete(listener);
        reject(new UciError(`Timed out waiting for ${what}`));
      }, timeoutMs);
      const listener = (line: string) => {
        if (!predicate(line)) return;
        clearTimeout(timer);
        this.listeners.delete(listener);
        resolve(line);
      };
      this.listeners.add(listener);
    });
  }

  /** Handshake. Resolves once the engine answers `isready`. */
  async init(timeoutMs = 12_000): Promise<void> {
    const ready = this.once((l) => l.startsWith('uciok'), timeoutMs, 'uciok');
    this.send('uci');
    await ready;
    const isReady = this.once((l) => l.startsWith('readyok'), timeoutMs, 'readyok');
    this.send('isready');
    await isReady;
  }

  setOption(name: string, value: string | number | boolean) {
    this.send(`setoption name ${name} value ${value}`);
  }

  /** Resolves when the engine confirms it has processed everything so far. */
  ready(timeoutMs = 12_000): Promise<void> {
    const p = this.once((l) => l.startsWith('readyok'), timeoutMs, 'readyok');
    this.send('isready');
    return p.then(() => undefined);
  }

  /** Runs `fn` with exclusive access to the engine. */
  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  async newGame(): Promise<void> {
    return this.exclusive(async () => {
      this.send('ucinewgame');
      await this.ready();
    });
  }

  async setPosition(fen: string): Promise<void> {
    return this.exclusive(async () => {
      this.send(`position fen ${fen}`);
    });
  }

  /** Search the current position. Only one search runs at a time. */
  async search(options: SearchOptions): Promise<SearchResult> {
    const depth = options.depth ?? 12;
    const movetimeMs = options.movetimeMs ?? 0;
    const multiPv = options.multiPv ?? 1;
    return this.exclusive(async () => {
      if (this.disposed) throw new UciError('Engine has been disposed');
      const best: SearchInfo[] = [];
      const latestByPv = new Map<number, SearchInfo>();

      const onLine = (line: string) => {
        if (!line.startsWith('info ')) return;
        const info = parseInfoLine(line);
        if (!info) return;
        latestByPv.set(info.multipv, info);
        options.onInfo?.(info);
      };
      this.listeners.add(onLine);

      const done = new Promise<string>((resolve, reject) => {
        const finish = (line: string) => {
          this.listeners.delete(listener);
          this.listeners.delete(onLine);
          clearTimeout(timer);
          options.signal?.removeEventListener('abort', onAbort);
          resolve(line);
        };
        const listener = (line: string) => {
          if (line.startsWith('bestmove')) finish(line);
        };
        const timer = setTimeout(() => {
          this.send('stop');
          // Give the engine a moment to answer the stop before giving up.
          setTimeout(() => {
            if (this.listeners.has(listener)) {
              this.listeners.delete(listener);
              this.listeners.delete(onLine);
              options.signal?.removeEventListener('abort', onAbort);
              reject(new UciError(`Engine did not answer within ${movetimeMs || depth} ms budget`));
            }
          }, 2000);
        }, movetimeMs ? movetimeMs + 8000 : 60_000);
        const onAbort = () => {
          this.send('stop');
          this.listeners.delete(listener);
          this.listeners.delete(onLine);
          clearTimeout(timer);
          reject(new UciError('Search aborted'));
        };
        if (options.signal) {
          if (options.signal.aborted) {
            onAbort();
            return;
          }
          options.signal.addEventListener('abort', onAbort, { once: true });
        }
        this.listeners.add(listener);
      });

      this.searching = true;
      try {
        if (multiPv > 1) this.send(`setoption name MultiPV value ${multiPv}`);
        else this.send('setoption name MultiPV value 1');
        this.send(movetimeMs ? `go movetime ${Math.max(50, Math.round(movetimeMs))}` : `go depth ${depth}`);
        const line = await done;
        for (const info of latestByPv.values()) best.push(info);
        best.sort((a, b) => a.multipv - b.multipv);
        const bestMove = line.replace(/^bestmove\s+/, '').split(/\s+/)[0] || '';
        if (!bestMove || bestMove === '(none)') {
          throw new UciError('Engine reported no move for this position');
        }
        const deepest = best.length
          ? Math.max(...best.map((b) => b.depth))
          : 0;
        return { move: bestMove, info: best, best: best[0] ?? null, depth: deepest };
      } finally {
        this.searching = false;
      }
    });
  }

  /** Ask the engine for its current score without starting a new search. */
  stop() {
    this.send('stop');
  }

  isSearching() {
    return this.searching;
  }

  dispose() {
    this.disposed = true;
    this.listeners.clear();
    try {
      this.worker.postMessage('quit');
    } catch {
      /* ignore */
    }
    try {
      this.worker.terminate();
    } catch {
      /* ignore */
    }
  }
}
