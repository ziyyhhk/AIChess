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
import { botEngineProfile, botPaceDifficulty, type Bot } from './bots';
import {
  DEFAULT_THINK_SETTINGS,
  pickThinkTargetMs,
  remainingThinkDelay,
  type ThinkTimeSettings,
} from './thinkTime';

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
  private think: ThinkTimeSettings = { ...DEFAULT_THINK_SETTINGS };
  /** The selected bot. Only used while the built-in engine is the opponent. */
  private bot: Bot | null = null;

  /**
   * Choose a bot, or pass null to play at the difficulty level instead. A bot
   * sets the engine strength and the thinking-time bucket for the engine.
   */
  setBot(bot: Bot | null) {
    this.bot = bot;
  }

  getBot(): Bot | null {
    return this.bot;
  }

  private isEngineOpponent(): boolean {
    const info = this.getModelInfo();
    return !info || info.providerId === 'stockfish';
  }

  /** The difficulty whose thinking-time range applies to the current opponent. */
  private paceKey(): StockfishDifficulty {
    if (this.bot && this.isEngineOpponent()) return botPaceDifficulty(this.bot.elo);
    return this.difficulty;
  }

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

  /**
   * Pacing for AI replies (see thinkTime.ts). This never changes what the engine
   * searches - it only controls how long a ready move waits before it is shown.
   */
  setThinkTime(settings: ThinkTimeSettings) {
    this.think = { ...settings };
  }

  /** The pacing target for the difficulty in play, in ms. */
  getThinkTargetMs(random?: () => number) {
    return pickThinkTargetMs(this.paceKey(), this.think, random);
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
      stockfishAdapter.setProfile(this.bot ? botEngineProfile(this.bot) : null);
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

      // Fast answers still wait out the target so the player can premove; a slow
      // engine is never delayed further.
      const target = pickThinkTargetMs(this.paceKey(), this.think);
      const wait = remainingThinkDelay(Date.now() - startedAt, target);
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
