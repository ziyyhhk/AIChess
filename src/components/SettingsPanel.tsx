import React, { useState } from 'react';
import type { AppSettings } from '../ai/types';
import { DEFAULT_SETTINGS } from '../ai/types';
import { MIN_THINK_CHOICES } from '../ai/thinkTime';

interface Props {
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
  apiKeys: Record<string, string>;
  onSaveKey: (provider: string, key: string) => void;
  onClearKey: (provider: string) => void;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle${checked ? ' on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-knob" />
    </button>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="setting-row">
      <div className="setting-text">
        <div className="setting-label">{label}</div>
        {hint && <div className="setting-hint">{hint}</div>}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}

function KeyRow({
  label,
  placeholder,
  saved,
  onSave,
  onClear,
}: {
  label: string;
  placeholder: string;
  saved: boolean;
  onSave: (key: string) => void;
  onClear: () => void;
}) {
  const [value, setValue] = useState('');
  return (
    <div className="key-row">
      <div className="key-head">
        <span className="setting-label">{label}</span>
        <span className={`badge ${saved ? 'ok' : 'muted'}`}>{saved ? 'Saved for this session' : 'Not set'}</span>
      </div>
      <form
        className="key-input"
        onSubmit={(e) => {
          e.preventDefault();
          const v = value.trim();
          if (!v) return;
          onSave(v);
          setValue('');
        }}
      >
        <input
          type="password"
          className="input"
          placeholder={placeholder}
          value={value}
          autoComplete="off"
          aria-label={`${label} API key`}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="submit" className="btn" disabled={!value.trim()}>
          Save
        </button>
        {saved && (
          <button type="button" className="btn" onClick={onClear}>
            Clear
          </button>
        )}
      </form>
    </div>
  );
}

export function SettingsPanel({ settings, onChange, apiKeys, onSaveKey, onClearKey }: Props) {
  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => onChange({ ...settings, [k]: v });

  return (
    <div className="view narrow">
      <header className="view-head">
        <h1>Settings</h1>
        <p>Preferences are saved in this browser.</p>
      </header>

      <section className="card" aria-labelledby="settings-board">
        <h2 className="card-title" id="settings-board">Board</h2>
        <Row label="Board colors">
          <select
            className="select"
            value={settings.boardTheme}
            onChange={(e) => set('boardTheme', e.target.value as AppSettings['boardTheme'])}
          >
            <option value="green">Green</option>
            <option value="brown">Brown</option>
            <option value="blue">Blue</option>
            <option value="purple">Purple</option>
          </select>
        </Row>
        <Row label="Coordinates" hint="File letters and rank numbers on the board">
          <Toggle label="Coordinates" checked={settings.showCoordinates} onChange={(v) => set('showCoordinates', v)} />
        </Row>
        <Row label="Legal move dots" hint="Show where the selected piece can go">
          <Toggle label="Legal move dots" checked={settings.showLegalMoves} onChange={(v) => set('showLegalMoves', v)} />
        </Row>
        <Row label="Slide animation" hint="Pieces glide to their new square">
          <Toggle label="Slide animation" checked={settings.enableAnimations} onChange={(v) => set('enableAnimations', v)} />
        </Row>
      </section>

      <section className="card" aria-labelledby="settings-play">
        <h2 className="card-title" id="settings-play">Play</h2>
        <Row label="Premoves" hint="Queue a move while the AI is thinking">
          <Toggle label="Premoves" checked={settings.enablePremoves} onChange={(v) => set('enablePremoves', v)} />
        </Row>
        <Row
          label="Minimum thinking time"
          hint="The AI waits at least this long before it replies. Longer times leave more room to premove."
        >
          <select
            className="select"
            value={settings.minThinkMs}
            onChange={(e) => set('minThinkMs', Number(e.target.value))}
          >
            {MIN_THINK_CHOICES.map((c) => (
              <option key={c.ms} value={c.ms}>
                {c.label}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Sounds">
          <Toggle label="Sounds" checked={settings.enableSounds} onChange={(v) => set('enableSounds', v)} />
        </Row>
      </section>

      <section className="card" aria-labelledby="settings-keys">
        <h2 className="card-title" id="settings-keys">API keys</h2>
        <p className="card-note">
          Stockfish needs no key. Keys stay in memory for this browser session and are never written to the repository.
        </p>
        <KeyRow
          label="Gemini"
          placeholder="AIza…"
          saved={!!apiKeys.gemini}
          onSave={(k) => onSaveKey('gemini', k)}
          onClear={() => onClearKey('gemini')}
        />
        <KeyRow
          label="OpenRouter"
          placeholder="sk-or-…"
          saved={!!apiKeys.openrouter}
          onSave={(k) => onSaveKey('openrouter', k)}
          onClear={() => onClearKey('openrouter')}
        />
      </section>

      <div className="form-foot">
        <button type="button" className="btn" onClick={() => onChange({ ...DEFAULT_SETTINGS })}>
          Reset preferences
        </button>
      </div>
    </div>
  );
}
