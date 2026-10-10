import React from 'react';
import type { ModelInfo } from '../ai/types';

interface Props {
  model: ModelInfo | undefined;
  thinking: boolean;
  status: string;
  error: string | null;
  canUndo: boolean;
  gameOver: boolean;
  onNewGame: () => void;
  onUndo: () => void;
  onFlip: () => void;
  onResign: () => void;
  onClearArrows: () => void;
  moveHistory: string[];
  difficulty: string;
  onDifficultyChange: (d: string) => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  volume?: number;
  onVolumeChange?: (v: number) => void;
}

export function GamePanel({
  model,
  thinking,
  status,
  error,
  canUndo,
  gameOver,
  onNewGame,
  onUndo,
  onFlip,
  onResign,
  onClearArrows,
  moveHistory,
  difficulty,
  onDifficultyChange,
  soundEnabled = true,
  onToggleSound,
  volume = 0.7,
  onVolumeChange,
}: Props) {
  const pairs: string[][] = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    pairs.push([moveHistory[i], moveHistory[i + 1] || '']);
  }

  return (
    <div
      className="game-panel"
      style={{
        width: 'var(--panel-w)',
        maxWidth: '100%',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        maxHeight: 'calc(100vh - 40px)',
        overflow: 'auto',
      }}
    >
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
          Opponent
        </div>
        <div style={{ fontWeight: 600 }}>{model?.name || 'Stockfish'}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {model?.provider || 'Local Engine'}
          {model?.free ? ' · Free' : ''}
          {model?.requiresKey ? ' · Key required' : ''}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
          Difficulty
        </div>
        <select
          value={difficulty}
          onChange={(e) => onDifficultyChange(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            color: 'var(--text)',
            fontSize: 13,
          }}
        >
          <option value="beginner">Beginner (very easy)</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
          <option value="expert">Expert</option>
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          className="btn"
          onClick={onToggleSound}
          title={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
          style={{ flexShrink: 0 }}
        >
          {soundEnabled ? 'Sound On' : 'Muted'}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => onVolumeChange?.(parseFloat(e.target.value))}
          style={{ flex: 1 }}
          title="Volume"
          disabled={!soundEnabled}
        />
      </div>

      <div
        style={{
          padding: '8px 10px',
          borderRadius: 6,
          background: thinking ? 'rgba(63,185,80,0.12)' : 'var(--bg-elevated)',
          fontSize: 13,
          minHeight: 36,
        }}
      >
        {thinking ? 'AI is thinking…' : status}
      </div>

      {error && (
        <div
          style={{
            padding: 8,
            borderRadius: 6,
            background: 'rgba(248,81,73,0.15)',
            color: 'var(--danger)',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button className="btn primary" onClick={onNewGame}>
          New Game
        </button>
        <button className="btn" onClick={onUndo} disabled={!canUndo || thinking}>
          Takeback
        </button>
        <button className="btn" onClick={onFlip}>
          Flip Board
        </button>
        <button className="btn danger" onClick={onResign} disabled={gameOver || thinking}>
          Resign
        </button>
      </div>

      <button className="btn" onClick={onClearArrows} style={{ width: '100%' }}>
        Clear Arrows
      </button>

      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
          Move History
        </div>
        <div
          style={{
            background: 'var(--bg)',
            borderRadius: 6,
            padding: 8,
            maxHeight: 220,
            overflowY: 'auto',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 13,
          }}
        >
          {pairs.length === 0 && (
            <span style={{ color: 'var(--text-muted)' }}>No moves yet</span>
          )}
          {pairs.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <span style={{ width: 28, color: 'var(--text-muted)' }}>{i + 1}.</span>
              <span style={{ width: 56 }}>{p[0]}</span>
              <span>{p[1]}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .btn {
          padding: 8px 12px;
          border-radius: 6px;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          font-size: 13px;
          font-weight: 500;
        }
        .btn:hover:not(:disabled) {
          background: #30363d;
        }
        .btn.primary {
          background: var(--accent-dim);
          border-color: var(--accent);
          color: #fff;
        }
        .btn.primary:hover:not(:disabled) {
          background: var(--accent);
        }
        .btn.danger {
          color: var(--danger);
        }
      `}</style>
    </div>
  );
}
