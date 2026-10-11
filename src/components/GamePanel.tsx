import React, { useState } from 'react';
import type { ModelInfo } from '../ai/types';
import { IconUndo, IconFlip, IconClear, IconSearch } from './Icons';

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
  onCopyPgn?: () => Promise<boolean>;
  /** The current PGN, fetched only when a fallback is needed. */
  getPgnText?: () => string;
  onDownloadPgn?: () => void;
  moveHistory: string[];
  difficulty: string;
  onDifficultyChange: (d: string) => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  volume?: number;
  onVolumeChange?: (v: number) => void;
  playerColor?: 'w' | 'b';
  isCheck?: boolean;
  onUseStockfish?: () => void;
  currentModelId?: string;
  premovesEnabled?: boolean;
  onAnalyze?: () => void;
  /** The queued premove, when there is one. */
  premove?: { from: string; to: string } | null;
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
  getPgnText,
  onDownloadPgn,
  moveHistory,
  difficulty,
  onDifficultyChange,
  soundEnabled = true,
  onToggleSound,
  volume = 0.7,
  onVolumeChange,
  playerColor = 'w',
  isCheck = false,
  onUseStockfish,
  currentModelId = 'stockfish',
  premovesEnabled = true,
  onAnalyze,
  premove = null,
}: Props) {
  const [pgnFeedback, setPgnFeedback] = useState<string | null>(null);
  /* Shown only when the clipboard really refused: the PGN stays selectable. */
  const [pgnFallback, setPgnFallback] = useState<string | null>(null);
  const pairs: string[][] = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    pairs.push([moveHistory[i], moveHistory[i + 1] || '']);
  }
  const lastIndex = moveHistory.length - 1;

  const isStockfish = currentModelId === 'stockfish' || model?.providerId === 'stockfish';
  const opponentName = isStockfish ? 'Stockfish' : model?.name || 'AI';

  const handleCopyPgn = async () => {
    if (!onCopyPgn) {
      setPgnFeedback('PGN not available');
      window.setTimeout(() => setPgnFeedback(null), 2000);
      return;
    }
    setPgnFeedback(null);
    let ok = false;
    try {
      ok = await onCopyPgn();
    } catch {
      ok = false;
    }
    if (ok) {
      setPgnFallback(null);
      setPgnFeedback('Copied to clipboard');
      window.setTimeout(() => setPgnFeedback(null), 2200);
    } else {
      // No clipboard access: hand the PGN over as selectable text instead.
      setPgnFallback(getPgnText ? getPgnText() : null);
      setPgnFeedback('Copying was blocked — select the text below.');
    }
  };

  const statusClass = ['gp-status', thinking ? 'is-thinking' : '', isCheck && !gameOver && !thinking ? 'is-check' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <aside className="game-panel" aria-label="Game controls">
      <section className="gp-section">
        <div className="gp-label">Opponent</div>
        <div className="gp-opponent-name">{opponentName}</div>
        <div className="gp-muted">
          {isStockfish ? 'Built-in engine. No key needed.' : `${model?.provider || 'AI'}. API key required.`}
        </div>
        {!isStockfish && onUseStockfish && (
          <button type="button" className="btn btn-block" onClick={onUseStockfish}>
            Use Stockfish instead
          </button>
        )}
      </section>

      {isStockfish && (
        <section className="gp-section">
          <label className="gp-label" htmlFor="gp-difficulty">Difficulty</label>
          <select
            id="gp-difficulty"
            className="select"
            value={difficulty}
            onChange={(e) => onDifficultyChange(e.target.value)}
          >
            <option value="beginner">Beginner</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
            <option value="expert">Expert</option>
          </select>
        </section>
      )}

      <section className="gp-section">
        <div className={statusClass} role="status" aria-live="polite">
          {thinking ? (
            <>
              <span className="thinking-dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              <span>
                {opponentName} is thinking.
                {premovesEnabled ? ' You can queue a premove now.' : ''}
              </span>
            </>
          ) : (
            status
          )}
        </div>
        {error && <div className="gp-error" role="alert">{error}</div>}
        {premove && (
          <div className="gp-premove" role="status">
            <span className="gp-premove-dot" aria-hidden />
            Premove queued: {premove.from} → {premove.to}
          </div>
        )}
      </section>

      <section className="gp-actions">
        <button type="button" className="btn primary gp-wide" onClick={onNewGame}>
          New game
        </button>
        <button type="button" className="btn" onClick={onUndo} disabled={!canUndo || thinking}>
          <IconUndo /> Takeback
        </button>
        <button type="button" className="btn" onClick={onFlip}>
          <IconFlip /> Flip board
        </button>
        <button type="button" className="btn danger gp-wide" onClick={onResign} disabled={gameOver || thinking}>
          Resign
        </button>
      </section>

      <section className="gp-section">
        <div className="gp-row gp-between">
          <span className="gp-label">Sound</span>
          <button
            type="button"
            role="switch"
            aria-checked={soundEnabled}
            aria-label="Sound"
            className={`toggle${soundEnabled ? ' on' : ''}`}
            onClick={onToggleSound}
          >
            <span className="toggle-knob" />
          </button>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => onVolumeChange?.(parseFloat(e.target.value))}
          className="range"
          disabled={!soundEnabled}
          aria-label="Volume"
        />
      </section>

      <section className="gp-section">
        <div className="gp-label">Review</div>
        <button type="button" className="btn btn-block" onClick={() => onAnalyze?.()} disabled={!onAnalyze}>
          <IconSearch /> Analyse game
        </button>
        <div className="gp-muted">
          Runs the engine over every move already played. The live game is not affected.
        </div>
      </section>

      <section className="gp-section">
        <div className="gp-label">Export</div>
        <div className="gp-pgn-actions">
          <button type="button" className="btn" onClick={handleCopyPgn}>
            Copy PGN
          </button>
          <button type="button" className="btn" onClick={() => onDownloadPgn?.()}>
            Download PGN
          </button>
        </div>
        {pgnFeedback && <div className="gp-pgn-feedback" role="status">{pgnFeedback}</div>}
        {pgnFallback && (
          <textarea
            className="gp-pgn-fallback"
            value={pgnFallback}
            readOnly
            rows={6}
            spellCheck={false}
            aria-label="Game PGN"
            onFocus={(e) => e.currentTarget.select()}
          />
        )}
      </section>

      <section className="gp-section gp-history">
        <div className="gp-label">
          Moves <span className="gp-count">{moveHistory.length}</span>
        </div>
        <div className="gp-moves" role="list">
          {pairs.length === 0 && <span className="gp-empty">No moves yet</span>}
          {pairs.map((p, i) => (
            <div key={i} className="gp-move-row" role="listitem">
              <span className="gp-move-num">{i + 1}.</span>
              <span className={`gp-san${lastIndex === i * 2 ? ' is-last' : ''}`}>{p[0]}</span>
              <span className={`gp-san${lastIndex === i * 2 + 1 ? ' is-last' : ''}`}>{p[1]}</span>
            </div>
          ))}
        </div>
        <div className="gp-muted">You play {playerColor === 'w' ? 'White' : 'Black'}</div>
      </section>

      <div className="gp-footer">
        <button type="button" className="btn ghost btn-block" onClick={onClearArrows}>
          <IconClear /> Clear arrows
        </button>
      </div>
    </aside>
  );
}
