import type { AIMoveRequest, AIMoveResponse, AIProvider } from '../types';
import { parseMoveFromResponse } from '../moveParser';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function buildPrompt(req: AIMoveRequest): string {
  return `You are a strong chess engine. Reply with exactly one legal move in UCI format only (example: e2e4 or e7e8q). No explanation.

Current FEN: ${req.fen}
Side to move: ${req.sideToMove === 'w' ? 'White' : 'Black'}
Legal moves (UCI): ${req.legalMoves.join(', ')}
Recent history (SAN): ${req.history.slice(-12).join(' ')}

Return only one move from the legal list. Preferred: {"move":"e2e4"}`;
}

export class GeminiProvider implements AIProvider {
  id = 'gemini';
  name = 'Google Gemini';
  requiresKey = true;

  constructor(private modelId: string = 'gemini-2.5-flash') {}

  setModel(id: string) { this.modelId = id; }

  async getMove(req: AIMoveRequest, apiKey?: string, signal?: AbortSignal): Promise<AIMoveResponse> {
    if (!apiKey) throw new Error('Gemini API key is required. Add it in Settings.');

    const url = `${GEMINI_BASE}/${this.modelId}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = {
      contents: [{ role: 'user', parts: [{ text: buildPrompt(req) }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 64 },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), req.timeoutMs || 30000);
    if (signal) signal.addEventListener('abort', () => controller.abort());

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) throw new Error('Invalid or unauthorized Gemini API key.');
        if (res.status === 429) throw new Error('Gemini rate limit exceeded. Try again later.');
        throw new Error(`Gemini API error ${res.status}`);
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const move = parseMoveFromResponse(String(text), req.legalMoves);
      if (!move) throw new Error(`Gemini returned an invalid move. Raw: ${String(text).slice(0, 120)}`);
      return { move, raw: String(text) };
    } catch (e) {
      clearTimeout(timeout);
      if (e instanceof Error && e.name === 'AbortError') throw new Error('Gemini request timed out or was cancelled.');
      throw e;
    }
  }

  async testConnection(apiKey: string): Promise<boolean> {
    try {
      const url = `${GEMINI_BASE}/${this.modelId}?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url);
      return res.ok;
    } catch { return false; }
  }
}
