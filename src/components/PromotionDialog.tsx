import React from 'react';

interface Props {
  color: 'w' | 'b';
  onSelect: (piece: 'q' | 'r' | 'b' | 'n') => void;
  onCancel: () => void;
}

const PIECES: { p: 'q' | 'r' | 'b' | 'n'; label: string }[] = [
  { p: 'q', label: 'Queen' },
  { p: 'r', label: 'Rook' },
  { p: 'b', label: 'Bishop' },
  { p: 'n', label: 'Knight' },
];

const UNICODE: Record<string, string> = {
  wq: '♕', wr: '♖', wb: '♗', wn: '♘',
  bq: '♛', br: '♜', bb: '♝', bn: '♞',
};

export function PromotionDialog({ color, onSelect, onCancel }: Props) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--bg-panel)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 16, display: 'flex', gap: 10,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {PIECES.map(({ p, label }) => (
          <button
            key={p}
            onClick={() => onSelect(p)}
            title={label}
            style={{
              width: 56, height: 56, fontSize: 32, borderRadius: 8,
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            }}
          >
            {UNICODE[`${color}${p}`]}
          </button>
        ))}
      </div>
    </div>
  );
}
