import React, { useState } from 'react';
import type { AppSettings } from '../ai/types';
import { DEFAULT_SETTINGS } from '../ai/types';

interface Props {
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
  apiKeys: Record<string, string>;
  onSaveKey: (provider: string, key: string) => void;
  onClearKey: (provider: string) => void;
}

export function SettingsPanel({ settings, onChange, apiKeys, onSaveKey, onClearKey }: Props) {
  const [geminiKey, setGeminiKey] = useState('');
  const [orKey, setOrKey] = useState('');
  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => onChange({ ...settings, [k]: v });
  const inputStyle: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' };
  const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10, fontSize: 13 };
  return (
    <div style={{ padding: 16, maxWidth: 640 }}>
      <h2 style={{ marginBottom: 16 }}>Settings</h2>
      <section style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, marginBottom: 10 }}>Board</h3>
        <label style={labelStyle}>Theme
          <select value={settings.boardTheme} onChange={(e) => set('boardTheme', e.target.value as AppSettings['boardTheme'])} style={inputStyle}>
            <option value="green">Green</option><option value="brown">Brown</option>
            <option value="blue">Blue</option><option value="purple">Purple</option>
          </select>
        </label>
        <label style={labelStyle}><input type="checkbox" checked={settings.showCoordinates} onChange={(e) => set('showCoordinates', e.target.checked)} /> Coordinates</label>
        <label style={labelStyle}><input type="checkbox" checked={settings.showLegalMoves} onChange={(e) => set('showLegalMoves', e.target.checked)} /> Legal move indicators</label>
        <label style={labelStyle}><input type="checkbox" checked={settings.enablePremoves} onChange={(e) => set('enablePremoves', e.target.checked)} /> Premoves</label>
      </section>
      <section style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, marginBottom: 10 }}>API Keys (optional)</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          Stockfish needs no key. Keys stay in this browser session only. Never committed.
        </p>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, marginBottom: 4 }}>Gemini {apiKeys.gemini ? '✓' : '— not set'}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="password" placeholder="AIza…" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <button className="btn" onClick={() => { if (geminiKey.trim()) { onSaveKey('gemini', geminiKey.trim()); setGeminiKey(''); } }}>Save</button>
            <button className="btn" onClick={() => onClearKey('gemini')}>Clear</button>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, marginBottom: 4 }}>OpenRouter {apiKeys.openrouter ? '✓' : '— not set'}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="password" placeholder="sk-or-…" value={orKey} onChange={(e) => setOrKey(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <button className="btn" onClick={() => { if (orKey.trim()) { onSaveKey('openrouter', orKey.trim()); setOrKey(''); } }}>Save</button>
            <button className="btn" onClick={() => onClearKey('openrouter')}>Clear</button>
          </div>
        </div>
      </section>
      <button className="btn" onClick={() => onChange({ ...DEFAULT_SETTINGS })}>Reset preferences</button>
    </div>
  );
}
