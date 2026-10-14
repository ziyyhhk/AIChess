/**
 * In-memory evaluation cache keyed by FEN.
 * Persisted per archived game via load/save helpers.
 */
import type { PositionEvaluation } from './evaluator';

export interface CachedEval {
  evaluation: PositionEvaluation;
  depth: number;
  multiPv: number;
  at: number;
}

const memory = new Map<string, CachedEval>();
const MAX_ENTRIES = 2000;

function cacheKey(fen: string, multiPv: number): string {
  return `${fen}|mpv=${multiPv}`;
}

export function getCachedEval(fen: string, minDepth: number, multiPv: number): PositionEvaluation | null {
  const hit = memory.get(cacheKey(fen, multiPv));
  if (!hit) return null;
  if (hit.depth < minDepth) return null;
  return hit.evaluation;
}

export function setCachedEval(fen: string, multiPv: number, evaluation: PositionEvaluation): void {
  if (memory.size >= MAX_ENTRIES) {
    const drop = Math.floor(MAX_ENTRIES * 0.1);
    let i = 0;
    for (const k of memory.keys()) {
      memory.delete(k);
      if (++i >= drop) break;
    }
  }
  memory.set(cacheKey(fen, multiPv), {
    evaluation,
    depth: evaluation.depth,
    multiPv,
    at: Date.now(),
  });
}

export function clearEvalCache(): void {
  memory.clear();
}

export function evalCacheSize(): number {
  return memory.size;
}

export function exportEvalCache(): Record<string, CachedEval> {
  const out: Record<string, CachedEval> = {};
  for (const [k, v] of memory) out[k] = v;
  return out;
}

export function importEvalCache(data: Record<string, CachedEval> | null | undefined): void {
  if (!data) return;
  for (const [k, v] of Object.entries(data)) {
    if (v?.evaluation && typeof v.depth === 'number') memory.set(k, v);
  }
}
