import type { AIMoveRequest, AIMoveResponse, AIProvider } from '../types';
import { parseMoveFromResponse } from '../moveParser';

export class OpenAICompatibleProvider implements AIProvider {
  id = 'openai-compatible';
  name = 'Custom OpenAI-compatible';
  requiresKey = true;

  constructor(
    private baseUrl: string = '',
    private modelId: string = 'gpt-4o-mini'
  ) {}

  setEndpoint(url: string, model: string) {
    this.baseUrl = url.replace(/\/$/, '');
    this.modelId = model;
  }

  async getMove(
    req: AIMoveRequest,
    apiKey?: string,
    signal?: AbortSignal
  ): Promise<AIMoveResponse> {
    if (!this.baseUrl) {
      throw new Error('Custom endpoint URL is not configured.');
    }
    if (!apiKey) {
      throw new Error('API key required for custom provider.');
    }

    const prompt = `Chess engine. Reply with one legal UCI move only.
FEN: ${req.fen}
Legal: ${req.legalMoves.join(' ')}
Return {"move":"uci"} or the UCI string.`;

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      req.timeoutMs || 30000
    );
    if (signal) signal.addEventListener('abort', () => controller.abort());

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelId,
          messages: [
            { role: 'system', content: 'Reply only with a legal UCI chess move.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          max_tokens: 40,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        throw new Error(`Custom provider error ${res.status}`);
      }
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || '';
      const move = parseMoveFromResponse(String(text), req.legalMoves);
      if (!move) throw new Error('Invalid move from custom model');
      return { move, raw: String(text) };
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  }
}
