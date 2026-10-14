import React, { useState } from 'react';
import type { AppSettings } from '../ai/types';
import { DEFAULT_SETTINGS } from '../ai/types';
import {
  THINK_MODE_LABELS,
  THINK_TARGET_MAX_MS,
  type ThinkMode,
} from '../ai/thinkTime';

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
          label="AI thinking time"
          hint="The engine searches immediately; this only controls how long a ready reply waits, so you have time to premove. A slow engine is never delayed further."
        >
          <select
            className="select"
            value={settings.thinkMode}
            onChange={(e) => set('thinkMode', e.target.value as ThinkMode)}
          >
            {(Object.keys(THINK_MODE_LABELS) as ThinkMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {THINK_MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </Row>
        {settings.thinkMode === 'custom' && (
          <Row label="Custom delay" hint={`${(settings.minThinkMs / 1000).toFixed(1)} seconds`}>
            <input
              type="range"
              className="range"
              min={0}
              max={THINK_TARGET_MAX_MS}
              step={100}
              value={settings.minThinkMs}
              onChange={(e) => set('minThinkMs', Number(e.target.value))}
              aria-label="Custom AI thinking delay in milliseconds"
            />
          </Row>
        )}
        <Row
          label="Your rating"
          hint="Optional. Used only for the tier icon next to your name. Leave blank if you prefer unrated."
        >
          <input
            type="number"
            className="input"
            min={0}
            max={3500}
            step={50}
            placeholder="e.g. 1200"
            value={settings.playerRating ?? ''}
            onChange={(e) => {
              const v = e.target.value.trim();
              set('playerRating', v === '' ? null : Math.max(0, Math.min(3500, Number(v) || 0)));
            }}
            aria-label="Your approximate rating"
          />
        </Row>
        <Row label="Sounds">
          <Toggle label="Sounds" checked={settings.enableSounds} onChange={(v) => set('enableSounds', v)} />
        </Row>
        <Row
          label="Sound pack"
          hint="The bundled pack ships with AIChess. The Chess.com option streams their public files from their CDN at runtime; those files are not part of this repository."
        >
          <select
            className="select"
            value={settings.soundPack}
            onChange={(e) => set('soundPack', e.target.value as AppSettings['soundPack'])}
          >
            <option value="builtin">Bundled (recommended)</option>
            <option value="chesscom">Chess.com files (external)</option>
          </select>
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
