import type { AIMoveRequest, AIMoveResponse, AIProvider, ModelInfo } from './types';
import { stockfishProvider } from './providers/stockfishAdapter';
import { GeminiProvider } from './providers/geminiProvider';
import { OpenRouterProvider } from './providers/openRouterProvider';
import { getModelById } from './modelCatalog';

export class AIManager {
  private gemini = new GeminiProvider();
  private openrouter = new OpenRouterProvider();
  private currentModelId = 'stockfish';
  private abortController: AbortController | null = null;
  private requestId = 0;

  setModel(modelId: string) {
    this.currentModelId = modelId;
    const info = getModelById(modelId);
    if (info?.providerId === 'gemini') this.gemini.setModel(modelId);
    else if (info?.providerId === 'openrouter') this.openrouter.setModel(modelId);
  }

  getModelId() { return this.currentModelId; }

  getProvider(): AIProvider {
    const info = getModelById(this.currentModelId);
    if (!info || info.providerId === 'stockfish') return stockfishProvider;
    if (info.providerId === 'gemini') return this.gemini;
    if (info.providerId === 'openrouter') return this.openrouter;
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

  async requestMove(req: AIMoveRequest, apiKeys: Record<string, string>): Promise<AIMoveResponse> {
    this.cancel();
    const myId = ++this.requestId;
    this.abortController = new AbortController();
    const provider = this.getProvider();
    const info = this.getModelInfo();
    const key =
      info?.providerId === 'gemini' ? apiKeys.gemini
      : info?.providerId === 'openrouter' ? apiKeys.openrouter
      : undefined;

    try {
      const result = await provider.getMove(req, key, this.abortController.signal);
      if (myId !== this.requestId) throw new Error('Stale AI request discarded');
      if (!req.legalMoves.includes(result.move)) {
        throw new Error(`Illegal move proposed: ${result.move}`);
      }
      return result;
    } finally {
      if (myId === this.requestId) this.abortController = null;
    }
  }
}

export const aiManager = new AIManager();
