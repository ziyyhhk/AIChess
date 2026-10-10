import React, { useEffect, useState } from 'react';
import type { Square } from 'chess.js';
import { pieceSrc, type PieceSetId } from '../chess/pieceAssets';

function squareToCoords(sq: Square, orientation: 'w' | 'b') {
  const file = sq.charCodeAt(0) - 97;
  const rank = parseInt(sq[1], 10) - 1;
  return {
    x: orientation === 'w' ? file : 7 - file,
    y: orientation === 'w' ? 7 - rank : rank,
  };
}

export function FlyingPiece({
  from,
  to,
  color,
  type,
  set,
  orientation,
  animKey,
}: {
  from: Square;
  to: Square;
  color: 'w' | 'b';
  type: string;
  set: PieceSetId;
  orientation: 'w' | 'b';
  animKey: number;
}) {
  const fc = squareToCoords(from, orientation);
  const tc = squareToCoords(to, orientation);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    setPhase(0);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase(1));
    });
    return () => cancelAnimationFrame(id);
  }, [animKey]);

  const left = (phase === 0 ? fc.x : tc.x) * 12.5;
  const top = (phase === 0 ? fc.y : tc.y) * 12.5;

  return (
    <div
      className="piece-flying"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: '12.5%',
        height: '12.5%',
        transition: phase === 0 ? 'none' : 'left 160ms ease-out, top 160ms ease-out',
      }}
    >
      <img
        className="piece-img"
        src={pieceSrc(color, type, set)}
        alt=""
        draggable={false}
      />
    </div>
  );
}
