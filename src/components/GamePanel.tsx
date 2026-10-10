import React, { useState } from 'react';
import type { ModelInfo } from '../ai/types';
import {
  IconUndo,
  IconFlip,
  IconClear,
} from './Icons';

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
  onCopyPgn: () => Promise<boolean>;
  onDownloadPgn: () => void;
  moveHistory: string[];
  difficulty: string;
  onDifficultyChange: (d: string) => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  volume?: number;
  onVolumeChange?: (v: number) => void;
  playerColor: 'w' | 'b';
  isCheck: boolean;
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
  onCopyPgn,
  onDownloadPgn,
  moveHistory,
  difficulty,
  onDifficultyChange,
  soundEnabled = true,
  onToggleSound,
  volume = 0.7,
  onVolumeChange,
  playerColor,
  isCheck,
}: Props) {
  const [pgnFeedback, setPgnFeedback] = useState<string | null>(null);
  const pairs: string[][] = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    pairs.push([moveHistory[i], moveHistory[i + 1] || '']);
  }

  const handleCopyPgn = async () => {
    setPgnFeedback(null);
    try {
      const ok = await onCopyPgn();
      setPgnFeedback(ok ? 'Copied to clipboard' : 'Copy failed — try Download');
    } catch {
      setPgnFeedback('Copy failed — try Download');
    }
    window.setTimeout(() => setPgnFeedback(null), 2200);
  };

  return (
    <aside className="game-panel" aria-label="Game controls">
      <section className="gp-section">
        <div className="gp-label">Opponent</div>
        <div className="gp-opponent-name">{model?.name || 'Stockfish'}</div>
        <div className="gp-muted">
          {model?.provider || 'Local Engine'}
          {model?.free ? ' · Free' : ''}
          {model?.requiresKey ? ' · Key required' : ''}
        </div>
      </section>

      <section className="gp-section">
        <div className="gp-label">Difficulty</div>
        <select
          className="gp-select"
          value={difficulty}
          onChange={(e) => onDifficultyChange(e.target.value)}
          aria-label="AI difficulty"
        >
          <option value="beginner">Beginner</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
          <option value="expert">Expert</option>
        </select>
      </section>

      <section className="gp-section gp-status-block">
        <div
          className={`gp-status ${thinking ? 'thinking' : ''} ${isCheck && !gameOver ? 'check' : ''}`}
        >
          {thinking ? 'AI is thinking…' : status}
        </div>
        {error && <div className="gp-error">{error}</div>}
      </section>

      <section className="gp-actions">
        <button type="button" className="btn primary" onClick={onNewGame}>
          New Game
        </button>
        <button
          type="button"
          className="btn"
          onClick={onUndo}
          disabled={!canUndo || thinking}
          title="Take back last full move"
        >
          <IconUndo /> Takeback
        </button>
        <button type="button" className="btn" onClick={onFlip} title="Flip board">
          <IconFlip /> Flip
        </button>
        <button
          type="button"
          className="btn danger"
          onClick={onResign}
          disabled={gameOver || thinking}
        >
          Resign
        </button>
      </section>

      <section className="gp-section gp-row">
        <button
          type="button"
          className="btn"
          onClick={onToggleSound}
          title={soundEnabled ? 'Mute' : 'Unmute'}
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
          className="gp-volume"
          title="Volume"
          disabled={!soundEnabled}
          aria-label="Volume"
        />
      </section>

      <section className="gp-section gp-pgn">
        <div className="gp-label">PGN</div>
        <div className="gp-pgn-actions">
          <button type="button" className="btn" onClick={handleCopyPgn}>
            Copy PGN
          </button>
          <button type="button" className="btn" onClick={onDownloadPgn}>
            Download
          </button>
        </div>
        {pgnFeedback && <div className="gp-pgn-feedback">{pgnFeedback}</div>}
      </section>

      <button type="button" className="btn gp-clear" onClick={onClearArrows}>
        <IconClear /> Clear arrows
      </button>

      <section className="gp-section gp-history">
        <div className="gp-label">
          Moves
          <span className="gp-muted"> · {moveHistory.length}</span>
        </div>
        <div className="gp-moves" role="list">
          {pairs.length === 0 && (
            <span className="gp-muted">No moves yet</span>
          )}
          {pairs.map((p, i) => (
            <div key={i} className="gp-move-row" role="listitem">
              <span className="gp-move-num">{i + 1}.</span>
              <span className="gp-san">{p[0]}</span>
              <span className="gp-san">{p[1]}</span>
            </div>
          ))}
        </div>
        <div className="gp-side-hint">
          You play {playerColor === 'w' ? 'White' : 'Black'}
        </div>
      </section>
    </aside>
  );
}
