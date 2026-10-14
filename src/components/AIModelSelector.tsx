import React, { useState } from 'react';
import { CURATED_MODELS } from '../ai/modelCatalog';
import type { ModelInfo } from '../ai/types';

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
  hasGeminiKey: boolean;
  hasOpenRouterKey: boolean;
}

const GROUP_LABELS: Record<string, string> = {
  stockfish: 'Built-in engine',
  gemini: 'Google Gemini',
  openrouter: 'OpenRouter free routes',
};

export function AIModelSelector({ selectedId, onSelect, hasGeminiKey, hasOpenRouterKey }: Props) {
  const [filter, setFilter] = useState('');
  const query = filter.trim().toLowerCase();
  const filtered = CURATED_MODELS.filter(
    (m) =>
      !query ||
      m.name.toLowerCase().includes(query) ||
      m.provider.toLowerCase().includes(query) ||
      m.id.toLowerCase().includes(query)
  );
  const groups: Record<string, ModelInfo[]> = {};
  for (const m of filtered) {
    if (!groups[m.providerId]) groups[m.providerId] = [];
    groups[m.providerId].push(m);
  }

  return (
    <div className="view">
      <header className="view-head">
        <h1>Opponents</h1>
        <p>Stockfish works with no account. Hosted models need your own free API key, set in Settings.</p>
      </header>

      <div className="search">
        <input
          type="search"
          className="input"
          placeholder="Search by name or provider"
          aria-label="Search opponents"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {filtered.length === 0 && <p className="gp-muted">No opponents match “{filter.trim()}”.</p>}

      {Object.entries(groups).map(([gid, models]) => (
        <section key={gid} className="model-group">
          <h2 className="group-title">{GROUP_LABELS[gid] || gid}</h2>
          <div className="model-grid">
            {models.map((m) => {
              const ready =
                !m.requiresKey ||
                (m.providerId === 'gemini' && hasGeminiKey) ||
                (m.providerId === 'openrouter' && hasOpenRouterKey);
              const selected = selectedId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`model-card${selected ? ' selected' : ''}`}
                  onClick={() => onSelect(m.id)}
                  aria-pressed={selected}
                >
                  <span className="model-top">
                    <span className="model-name">{m.name}</span>
                    {ready ? (
                      <span className="badge ok">Ready</span>
                    ) : (
                      <span className="badge warn">Key needed</span>
                    )}
                  </span>
                  <span className="model-meta">
                    {m.provider}, {m.free ? 'Free tier' : 'Paid'}
                    {selected ? ' (playing now)' : ''}
                  </span>
                  {m.description && <span className="model-desc">{m.description}</span>}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
