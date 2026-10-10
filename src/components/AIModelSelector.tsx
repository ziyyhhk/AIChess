import React, { useState } from 'react';
import { CURATED_MODELS } from '../ai/modelCatalog';
import type { ModelInfo } from '../ai/types';

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
  hasGeminiKey: boolean;
  hasOpenRouterKey: boolean;
}

export function AIModelSelector({ selectedId, onSelect, hasGeminiKey, hasOpenRouterKey }: Props) {
  const [filter, setFilter] = useState('');
  const filtered = CURATED_MODELS.filter(
    (m) =>
      m.name.toLowerCase().includes(filter.toLowerCase()) ||
      m.provider.toLowerCase().includes(filter.toLowerCase()) ||
      m.id.toLowerCase().includes(filter.toLowerCase())
  );
  const groups: Record<string, ModelInfo[]> = {};
  for (const m of filtered) {
    if (!groups[m.providerId]) groups[m.providerId] = [];
    groups[m.providerId].push(m);
  }
  const groupLabels: Record<string, string> = {
    stockfish: 'Built-in Engine (no key)',
    gemini: 'Google Gemini (your key)',
    openrouter: 'OpenRouter free routes (your key)',
  };
  return (
    <div style={{ padding: 16, maxWidth: 720 }}>
      <h2 style={{ marginBottom: 12 }}>AI Opponents</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
        Stockfish works with no account. Hosted models need your own free-tier API key.
      </p>
      <input type="search" placeholder="Search models…" value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', marginBottom: 16 }} />
      {Object.entries(groups).map(([gid, models]) => (
        <div key={gid} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
            {groupLabels[gid] || gid}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {models.map((m) => {
              const ready = !m.requiresKey || (m.providerId === 'gemini' && hasGeminiKey) || (m.providerId === 'openrouter' && hasOpenRouterKey);
              return (
                <button key={m.id} onClick={() => onSelect(m.id)}
                  style={{ textAlign: 'left', padding: 12, borderRadius: 8,
                    border: selectedId === m.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: selectedId === m.id ? 'rgba(63,185,80,0.1)' : 'var(--bg-panel)' }}>
                  <div style={{ fontWeight: 600 }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    {m.id} · {m.free ? 'Free' : 'Paid'} ·{' '}
                    {ready ? <span style={{ color: 'var(--accent)' }}>Ready</span> : <span style={{ color: 'var(--warning)' }}>Key needed</span>}
                  </div>
                  {m.description && <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-muted)' }}>{m.description}</div>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
