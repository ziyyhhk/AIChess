import React from 'react';

interface Props {
  result: string;
  onNewGame: () => void;
  onClose: () => void;
}

export function GameResultDialog({ result, onNewGame, onClose }: Props) {
  const label =
    result === 'white' ? 'White wins'
    : result === 'black' ? 'Black wins'
    : result === 'stalemate' ? 'Draw by stalemate'
    : result === 'insufficient' ? 'Draw by insufficient material'
    : result === 'threefold' ? 'Draw by threefold repetition'
    : result === 'fifty' ? 'Draw by the fifty-move rule'
    : result === 'resign' ? 'Resignation'
    : 'Draw';

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="dialog result-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Game over"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-title">Game over</div>
        <p className="dialog-text">{label}</p>
        <div className="dialog-actions">
          <button type="button" className="btn primary" onClick={onNewGame}>
            New game
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
