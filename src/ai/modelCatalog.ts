import type { ModelInfo } from './types';

/** Curated list. Stockfish is the no-key default. Hosted models need user keys. */
export const CURATED_MODELS: ModelInfo[] = [
  {
    id: 'stockfish',
    name: 'Stockfish (Built-in)',
    provider: 'Local Engine',
    providerId: 'stockfish',
    free: true,
    requiresKey: false,
    description: 'Browser chess engine. No API key required. Play immediately.',
    lastVerified: '2026-10-10',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google Gemini',
    providerId: 'gemini',
    free: true,
    requiresKey: true,
    description: 'Fast model. Free tier via Google AI Studio (your key).',
    lastVerified: '2026-10-10',
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'Google Gemini',
    providerId: 'gemini',
    free: true,
    requiresKey: true,
    description: 'Previous Flash generation. Free tier with your key.',
    lastVerified: '2026-10-10',
  },
  {
    id: 'google/gemma-4-31b-it:free',
    name: 'Gemma 4 31B (free)',
    provider: 'OpenRouter',
    providerId: 'openrouter',
    free: true,
    requiresKey: true,
    description: 'OpenRouter free route. Rate limited. Requires OpenRouter key.',
    lastVerified: '2026-10-05',
  },
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    name: 'Nemotron 3.5 Lightning (free)',
    provider: 'OpenRouter',
    providerId: 'openrouter',
    free: true,
    requiresKey: true,
    description: 'NVIDIA free route on OpenRouter. Rate limited.',
    lastVerified: '2026-10-05',
  },
  {
    id: 'qwen/qwen3.8-27b:free',
    name: 'Qwen 3.8 27B (free)',
    provider: 'OpenRouter',
    providerId: 'openrouter',
    free: true,
    requiresKey: true,
    description: 'Qwen free route. Requires OpenRouter key.',
    lastVerified: '2026-10-05',
  },
];

export function getModelsByProvider(providerId: string): ModelInfo[] {
  return CURATED_MODELS.filter((m) => m.providerId === providerId);
}

export function getModelById(id: string): ModelInfo | undefined {
  return CURATED_MODELS.find((m) => m.id === id);
}
