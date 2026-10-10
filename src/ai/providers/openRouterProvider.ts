import type { AIMoveRequest, AIMoveResponse, AIProvider } from '../types';
import { parseMoveFromResponse } from '../moveParser';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function buildPrompt(req: AIMoveRequest): string {
  return `You are a chess engine. Output exactly one legal UCI move and nothing else (e.g. e2e4 or e7e8q).

FEN: ${req.fen}
Side: ${req.sideToMove === 'w' ? 'White' : 'Black'}
Legal UCI moves: ${req.legalMoves.join(' ')}
History: ${req.history.slice(-16).join(' ')}

Respond with JSON: {"move":"<uci>"} or just the UCI string.`;
}

export class OpenRouterProvider implements AIProvider {
  id = 'openrouter';
  name = 'OpenRouter';
  requiresKey = true;

  constructor(private modelId: string = 'google/gemma-4-31b-it:free') {}

  setModel(id: string) { this.modelId = id; }

  async getMove(req: AIMoveRequest, apiKey?: string, signal?: AbortSignal): Promise<AIMoveResponse> {
    if (!apiKey) throw new Error('OpenRouter API key is required. Add it in Settings.');

    const body = {
      model: this.modelId,
      messages: [
        { role: 'system', content: 'You are a precise chess move generator. Reply only with a legal UCI move or {"move":"uci"}.' },
        { role: 'user', content: buildPrompt(req) },
      ],
      temperature: 0.1,
      max_tokens: 48,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), req.timeoutMs || 30000);
    if (signal) signal.addEventListener('abort', () => controller.abort());

    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://github.com/ziyyhhk/AIChess',
          'X-Title': 'AIChess',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        if (res.status === 401) throw new Error('Invalid OpenRouter API key.');
        if (res.status === 429) throw new Error('OpenRouter rate limit (free tier is limited). Try later or switch model.');
        throw new Error(`OpenRouter error ${res.status}`);
      }
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || '';
      const move = parseMoveFromResponse(String(text), req.legalMoves);
      if (!move) throw new Error(`Model returned invalid move. Raw: ${String(text).slice(0, 120)}`);
      return { move, raw: String(text) };
    } catch (e) {
      clearTimeout(timeout);
      if (e instanceof Error && e.name === 'AbortError') throw new Error('OpenRouter request timed out or was cancelled.');
      throw e;
    }
  }

  async testConnection(apiKey: string): Promise<boolean> {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.ok;
    } catch { return false; }
  }
}
