import type { AIMoveRequest, AIMoveResponse, AIProvider, ModelInfo } from './types';
import {
  stockfishProvider,
  stockfishAdapter,
  type StockfishDifficulty,
} from './providers/stockfishAdapter';
import { GeminiProvider } from './providers/geminiProvider';
import { OpenRouterProvider } from './providers/openRouterProvider';
import { OpenAICompatibleProvider } from './providers/openAICompatibleProvider';
import { getModelById } from './modelCatalog';
import { DEFAULT_MIN_THINK_MS, clampMinThinkMs, remainingThinkDelay } from './thinkTime';

/** Resolves after `ms`, or rejects as soon as `signal` aborts. */
function waitMs(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('AI request aborted'));
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onAbort = () => {
      if (timer !== undefined) clearTimeout(timer);
      reject(new Error('AI request aborted'));
    };
    timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export class AIManager {
  private gemini = new GeminiProvider();
  private openrouter = new OpenRouterProvider();
  private custom = new OpenAICompatibleProvider();
  private currentModelId = 'stockfish';
  private abortController: AbortController | null = null;
  private requestId = 0;
  private difficulty: StockfishDifficulty = 'medium';
  private customOpts = { skillLevel: 10, depth: 10, movetimeMs: 1200 };
  private minThinkMs = DEFAULT_MIN_THINK_MS;

  setModel(modelId: string) {
    this.currentModelId = modelId;
    const info = getModelById(modelId);
    if (info?.providerId === 'gemini') {
      this.gemini.setModel(modelId);
    } else if (info?.providerId === 'openrouter') {
      this.openrouter.setModel(modelId);
    }
  }

  setDifficulty(
    d: StockfishDifficulty,
    custom?: { skillLevel?: number; depth?: number; movetimeMs?: number }
  ) {
    this.difficulty = d;
    if (custom) this.customOpts = { ...this.customOpts, ...custom };
    stockfishAdapter.setDifficulty(d, this.customOpts);
  }

  /** Every AI move takes at least this long to appear (see thinkTime.ts). */
  setMinThinkMs(ms: number) {
    this.minThinkMs = clampMinThinkMs(ms);
  }

  getModelId() {
    return this.currentModelId;
  }

  getProvider(): AIProvider {
    const info = getModelById(this.currentModelId);
    if (!info || info.providerId === 'stockfish') return stockfishProvider;
    if (info.providerId === 'gemini') return this.gemini;
    if (info.providerId === 'openrouter') return this.openrouter;
    if (info.providerId === 'openai-compatible') return this.custom;
    return stockfishProvider;
  }

  getModelInfo(): ModelInfo | undefined {
    return getModelById(this.currentModelId);
  }

  cancel() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.requestId++;
  }

  async requestMove(
    req: AIMoveRequest,
    apiKeys: Record<string, string>
  ): Promise<AIMoveResponse> {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    const myId = ++this.requestId;
    const controller = new AbortController();
    this.abortController = controller;
    const provider = this.getProvider();
    const info = this.getModelInfo();

    if (!info || info.providerId === 'stockfish') {
      stockfishAdapter.setDifficulty(this.difficulty, this.customOpts);
    }

    const key =
      info?.providerId === 'gemini'
        ? apiKeys.gemini
        : info?.providerId === 'openrouter'
          ? apiKeys.openrouter
          : info?.providerId === 'openai-compatible'
            ? apiKeys.custom
            : undefined;

    const startedAt = Date.now();
    try {
      const result = await provider.getMove(req, key, controller.signal);

      // Fast answers still wait out the minimum so the player can premove.
      const wait = remainingThinkDelay(Date.now() - startedAt, this.minThinkMs);
      if (wait > 0) await waitMs(wait, controller.signal);

      if (myId !== this.requestId) {
        throw new Error('Stale AI request discarded');
      }
      if (!req.legalMoves.includes(result.move)) {
        throw new Error(`Illegal move proposed: ${result.move}`);
      }
      return { ...result, thinkingMs: Date.now() - startedAt };
    } finally {
      if (myId === this.requestId) {
        this.abortController = null;
      }
    }
  }
}

export const aiManager = new AIManager();
