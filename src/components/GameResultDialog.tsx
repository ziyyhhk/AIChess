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
    : result === 'insufficient' ? 'Draw — insufficient material'
    : result === 'threefold' ? 'Draw — threefold repetition'
    : result === 'fifty' ? 'Draw — fifty-move rule'
    : result === 'resign' ? 'Resignation'
    : 'Draw';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-panel)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 28, textAlign: 'center', minWidth: 260,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Game Over</div>
        <div style={{ color: 'var(--text-muted)', marginBottom: 20 }}>{label}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={onNewGame}
            style={{
              padding: '10px 18px', borderRadius: 6,
              background: 'var(--accent-dim)', color: '#fff', fontWeight: 600,
            }}
          >New Game</button>
          <button
            onClick={onClose}
            style={{
              padding: '10px 18px', borderRadius: 6,
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            }}
          >Close</button>
        </div>
      </div>
    </div>
  );
}
