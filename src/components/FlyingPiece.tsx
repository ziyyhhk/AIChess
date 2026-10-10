import React, { useEffect, useLayoutEffect, useRef } from 'react';
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

/**
 * Renders a piece sliding from `from` to `to`.
 * Uses a forced reflow + CSS transition so the browser always paints
 * the start position before animating to the end.
 */
export function FlyingPiece({
  from,
  to,
  color,
  type,
  set,
  orientation,
  animKey,
  durationMs = 180,
  onComplete,
}: {
  from: Square;
  to: Square;
  color: 'w' | 'b';
  type: string;
  set: PieceSetId;
  orientation: 'w' | 'b';
  animKey: number;
  durationMs?: number;
  onComplete?: () => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);

  const fc = squareToCoords(from, orientation);
  const tc = squareToCoords(to, orientation);

  // Percentage of the flying element's own size (which is 12.5% of the board).
  const startX = fc.x * 100;
  const startY = fc.y * 100;
  const endX = tc.x * 100;
  const endY = tc.y * 100;

  useLayoutEffect(() => {
    completedRef.current = false;
    const el = elRef.current;
    if (!el) return;

    // Start at source with no transition.
    el.style.transition = 'none';
    el.style.transform = `translate(${startX}%, ${startY}%)`;

    // Force reflow so the browser commits the start position.
    void el.offsetWidth;

    // Then enable transition and move to destination.
    el.style.transition = `transform ${durationMs}ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
    el.style.transform = `translate(${endX}%, ${endY}%)`;
  }, [animKey, startX, startY, endX, endY, durationMs]);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const finish = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      onComplete?.();
    };

    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName === 'transform') finish();
    };

    el.addEventListener('transitionend', onEnd);
    // Fallback in case transitionend is missed (tab background, reduced motion, etc.)
    const fallback = window.setTimeout(finish, durationMs + 80);

    return () => {
      el.removeEventListener('transitionend', onEnd);
      clearTimeout(fallback);
    };
  }, [animKey, durationMs, onComplete]);

  return (
    <div
      ref={elRef}
      className="piece-flying"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '12.5%',
        height: '12.5%',
        transform: `translate(${startX}%, ${startY}%)`,
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
