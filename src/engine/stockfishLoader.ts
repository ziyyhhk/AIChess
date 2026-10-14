/**
 * Loading the Stockfish worker.
 *
 * Preference order:
 *   1. `public/engines/stockfish.js` - a real build committed or dropped in by
 *      the site owner. The repository ships only a small placeholder, so this is
 *      skipped unless a full engine (over 5 KB, no stub marker) is present.
 *   2. The jsDelivr build of `stockfish.js` 10.0.2, fetched once per session and
 *      started from a blob URL so it works under a GitHub Pages sub-path.
 *
 * The same loader serves gameplay and analysis; each caller gets its own worker
 * so an analysis search can never interrupt the engine that is playing.
 */

export const STOCKFISH_CDN_URL =
  'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js';

/** A placeholder stub must never be mistaken for a real engine. */
export function isUsableEngineSource(text: string): boolean {
  if (!text || text.length < 5000) return false;
  return !(
    text.includes('Stockfish-Lite-Stub') ||
    text.includes('Stockfish-Placeholder') ||
    text.includes('bestmove (none)')
  );
}

export function localEngineUrl(): string {
  const base = (import.meta.env?.BASE_URL as string) || '/';
  const normalized = base.endsWith('/') ? base : `${base}/`;
  return `${normalized}engines/stockfish.js`;
}

export interface LoadedEngine {
  worker: Worker;
  source: 'local' | 'cdn';
  url: string;
}

export interface LoadEngineOptions {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  /** Test hook: build a worker from engine source text. */
  createWorker?: (source: string, url: string) => Worker;
}

function defaultCreateWorker(source: string, url: string): Worker {
  void url;
  const blob = new Blob([source], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
}

async function fetchText(
  url: string,
  options: LoadEngineOptions
): Promise<string | null> {
  const doFetch = options.fetchImpl ?? fetch;
  try {
    const res = await doFetch(url, { signal: options.signal, cache: 'force-cache' });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Fetch and start an engine worker. Throws with a human-readable reason when no
 * engine source can be obtained - callers surface that instead of pretending
 * analysis worked.
 */
export async function loadStockfishWorker(
  options: LoadEngineOptions = {}
): Promise<LoadedEngine> {
  if (typeof Worker === 'undefined') {
    throw new Error('Web Workers are unavailable in this browser');
  }
  const createWorker = options.createWorker ?? defaultCreateWorker;

  const localUrl = localEngineUrl();
  const localText = await fetchText(localUrl, options);
  if (localText && isUsableEngineSource(localText)) {
    return { worker: createWorker(localText, localUrl), source: 'local', url: localUrl };
  }

  const cdnText = await fetchText(STOCKFISH_CDN_URL, options);
  if (cdnText && cdnText.length > 1000) {
    return { worker: createWorker(cdnText, STOCKFISH_CDN_URL), source: 'cdn', url: STOCKFISH_CDN_URL };
  }

  throw new Error(
    'Stockfish could not be loaded. `public/engines/stockfish.js` is a placeholder and the CDN copy is unreachable (offline, blocked network, or a content blocker).'
  );
}
