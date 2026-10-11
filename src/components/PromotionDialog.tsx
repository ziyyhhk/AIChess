import React from 'react';
import { pieceSrc } from '../chess/pieceAssets';

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

export function PromotionDialog({ color, onSelect, onCancel }: Props) {
  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Choose a piece to promote to"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-title">Promote pawn</div>
        <div className="promo-choices">
          {PIECES.map(({ p, label }) => (
            <button key={p} type="button" className="promo-btn" onClick={() => onSelect(p)} title={label}>
              <img src={pieceSrc(color, p)} alt="" draggable={false} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
