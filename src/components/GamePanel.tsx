import React, { useState } from 'react';
import type { ModelInfo } from '../ai/types';
import { IconUndo, IconFlip, IconClear, IconSearch } from './Icons';
import { RatingTierIcon } from './RatingTierIcon';
import { ratingFromDifficulty } from '../ui/ratingTiers';

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
  premove?: { from: string; to: string } | null;
  playerRating?: number | null;
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
  playerRating = null,
}: Props) {
  const [pgnFeedback, setPgnFeedback] = useState<string | null>(null);
  const [pgnFallback, setPgnFallback] = useState<string | null>(null);
  const pairs: string[][] = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    pairs.push([moveHistory[i], moveHistory[i + 1] || '']);
  }
  const lastIndex = moveHistory.length - 1;

  const isStockfish = currentModelId === 'stockfish' || model?.providerId === 'stockfish';
  const opponentName = isStockfish ? 'Stockfish' : model?.name || 'AI';

  const handleCopyPgn = async () => {
    setPgnFallback(null);
    if (!onCopyPgn) return;
    try {
      const ok = await onCopyPgn();
      if (ok) {
        setPgnFeedback('PGN copied');
        setTimeout(() => setPgnFeedback(null), 2000);
      } else {
        setPgnFeedback('Copying was blocked — select the text below.');
        if (getPgnText) setPgnFallback(getPgnText());
      }
    } catch {
      setPgnFeedback('Copying was blocked — select the text below.');
      if (getPgnText) setPgnFallback(getPgnText());
    }
  };

  const statusClass = ['gp-status', thinking ? 'is-thinking' : '', isCheck && !gameOver && !thinking ? 'is-check' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <aside className="game-panel" aria-label="Game controls">
      <section className="gp-section">
        <div className="gp-label">Opponent</div>
        <div className="gp-opponent-name">
          <RatingTierIcon rating={isStockfish ? ratingFromDifficulty(difficulty) : null} size={14} />
          {' '}{opponentName}
        </div>
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
          <div className="gp-premove">Premove: {premove.from}→{premove.to}</div>
        )}
      </section>

      <section className="gp-section gp-actions">
        <button type="button" className="btn primary" onClick={onNewGame}>
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
        {onAnalyze && (
          <button type="button" className="btn gp-wide" onClick={onAnalyze} disabled={moveHistory.length === 0}>
            <IconSearch /> Analyse game
          </button>
        )}
        <button type="button" className="btn" onClick={onClearArrows}>
          <IconClear /> Clear arrows
        </button>
        {onCopyPgn && (
          <button type="button" className="btn" onClick={() => void handleCopyPgn()}>
            Copy PGN
          </button>
        )}
        {onDownloadPgn && (
          <button type="button" className="btn" onClick={onDownloadPgn}>
            Download PGN
          </button>
        )}
        {onToggleSound && (
          <button type="button" className="btn" onClick={onToggleSound}>
            Sound: {soundEnabled ? 'On' : 'Off'}
          </button>
        )}
      </section>

      {pgnFeedback && <div className="gp-muted">{pgnFeedback}</div>}
      {pgnFallback && (
        <textarea className="gp-pgn-fallback" readOnly rows={4} value={pgnFallback} />
      )}

      <section className="gp-section">
        <div className="gp-label">Moves</div>
        <ol className="gp-moves">
          {pairs.map((pair, i) => (
            <li key={i}>
              <span className="gp-move-num">{i + 1}.</span>
              <span className={lastIndex === i * 2 ? 'is-last' : ''}>{pair[0]}</span>
              {pair[1] && <span className={lastIndex === i * 2 + 1 ? 'is-last' : ''}>{pair[1]}</span>}
            </li>
          ))}
        </ol>
        <div className="gp-muted">
          <RatingTierIcon rating={playerRating} size={12} />
          {' '}You play {playerColor === 'w' ? 'White' : 'Black'}
        </div>
      </section>
    </aside>
  );
}
