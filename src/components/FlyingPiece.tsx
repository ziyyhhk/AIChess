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

/** Renders a piece sliding from `from` to `to` using CSS transform. */
export function FlyingPiece({
  from,
  to,
  color,
  type,
  set,
  orientation,
  animKey,
  durationMs = 180,
}: {
  from: Square;
  to: Square;
  color: 'w' | 'b';
  type: string;
  set: PieceSetId;
  orientation: 'w' | 'b';
  animKey: number;
  durationMs?: number;
}) {
  const fc = squareToCoords(from, orientation);
  const tc = squareToCoords(to, orientation);
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    setMoved(false);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setMoved(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [animKey]);

  const x = (moved ? tc.x : fc.x) * 12.5;
  const y = (moved ? tc.y : fc.y) * 12.5;

  return (
    <div
      className="piece-flying"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '12.5%',
        height: '12.5%',
        transform: `translate(${(x / 12.5) * 100}%, ${(y / 12.5) * 100}%)`,
        transition: moved
          ? `transform ${durationMs}ms cubic-bezier(0.25, 0.1, 0.25, 1)`
          : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 8,
        willChange: 'transform',
      }}
    >
      <img
        className="piece-img"
        src={pieceSrc(color, type, set)}
        alt=""
        draggable={false}
        style={{ width: '88%', height: '88%', objectFit: 'contain' }}
      />
    </div>
  );
}
