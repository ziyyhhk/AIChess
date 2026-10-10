import type { ModelInfo } from './types';

/** Curated fallback list. Free routes change; last verified Oct 2026. */
export const CURATED_MODELS: ModelInfo[] = [
  {
    id: 'stockfish',
    name: 'Stockfish (Built-in)',
    provider: 'Local Engine',
    providerId: 'stockfish',
    free: true,
    requiresKey: false,
    description:
      'Real Stockfish in the browser (CDN worker). No API key. Adjust difficulty in the game panel.',
    lastVerified: '2026-10-10',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google Gemini',
    providerId: 'gemini',
    free: true,
    requiresKey: true,
    description: 'Fast multimodal model. Free tier available via Google AI Studio.',
    lastVerified: '2026-10-10',
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'Google Gemini',
    providerId: 'gemini',
    free: true,
    requiresKey: true,
    description: 'Previous generation Flash. Free tier via AI Studio.',
    lastVerified: '2026-10-10',
  },
  {
    id: 'gemini-flash-lite-latest',
    name: 'Gemini Flash-Lite',
    provider: 'Google Gemini',
    providerId: 'gemini',
    free: true,
    requiresKey: true,
    description: 'Lightweight Flash variant. Free tier available.',
    lastVerified: '2026-10-10',
  },
  {
    id: 'google/gemma-4-31b-it:free',
    name: 'Gemma 4 31B (free)',
    provider: 'OpenRouter',
    providerId: 'openrouter',
    free: true,
    requiresKey: true,
    description: 'Google Gemma 4 via OpenRouter free route. Rate limited.',
    lastVerified: '2026-10-05',
  },
  {
    id: 'google/gemma-4-26b-a4b-it:free',
    name: 'Gemma 4 26B A4B (free)',
    provider: 'OpenRouter',
    providerId: 'openrouter',
    free: true,
    requiresKey: true,
    description: 'Gemma 4 26B MoE free route on OpenRouter.',
    lastVerified: '2026-10-05',
  },
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    name: 'Nemotron 3.5 Lightning (free)',
    provider: 'OpenRouter',
    providerId: 'openrouter',
    free: true,
    requiresKey: true,
    description: 'NVIDIA free route. High throughput, rate limited.',
    lastVerified: '2026-10-05',
  },
  {
    id: 'qwen/qwen3.8-27b:free',
    name: 'Qwen 3.8 27B (free)',
    provider: 'OpenRouter',
    providerId: 'openrouter',
    free: true,
    requiresKey: true,
    description: 'Qwen free route on OpenRouter.',
    lastVerified: '2026-10-05',
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B (free)',
    provider: 'OpenRouter',
    providerId: 'openrouter',
    free: true,
    requiresKey: true,
    description: 'Meta Llama free route when available.',
    lastVerified: '2026-10-05',
  },
];

export function getModelsByProvider(providerId: string): ModelInfo[] {
  return CURATED_MODELS.filter((m) => m.providerId === providerId);
}

export function getModelById(id: string): ModelInfo | undefined {
  return CURATED_MODELS.find((m) => m.id === id);
}
