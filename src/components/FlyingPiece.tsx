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
 * Piece slides from source square to destination using Web Animations API
 * with left/top as percentages of the board (reliable across browsers).
 */
export function FlyingPiece({
  from,
  to,
  color,
  type,
  set,
  orientation,
  animKey,
  durationMs = 200,
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
  const doneRef = useRef(false);

  const fc = squareToCoords(from, orientation);
  const tc = squareToCoords(to, orientation);
  const startLeft = `${fc.x * 12.5}%`;
  const startTop = `${fc.y * 12.5}%`;
  const endLeft = `${tc.x * 12.5}%`;
  const endTop = `${tc.y * 12.5}%`;

  useLayoutEffect(() => {
    doneRef.current = false;
    const el = elRef.current;
    if (!el) return;

    // Place at source immediately (no transition).
    el.style.left = startLeft;
    el.style.top = startTop;
    el.style.transform = 'translate(0, 0)';

    // Prefer Web Animations API — animates layout positions reliably.
    let anim: Animation | null = null;
    try {
      anim = el.animate(
        [
          { left: startLeft, top: startTop },
          { left: endLeft, top: endTop },
        ],
        {
          duration: durationMs,
          easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
          fill: 'forwards',
        }
      );
    } catch {
      // Fallback: CSS transition on left/top
      void el.offsetWidth;
      el.style.transition = `left ${durationMs}ms cubic-bezier(0.25, 0.1, 0.25, 1), top ${durationMs}ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
      el.style.left = endLeft;
      el.style.top = endTop;
    }

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      el.style.left = endLeft;
      el.style.top = endTop;
      onComplete?.();
    };

    if (anim) {
      anim.onfinish = finish;
      anim.oncancel = finish;
    }

    const fallback = window.setTimeout(finish, durationMs + 50);

    return () => {
      window.clearTimeout(fallback);
      try {
        anim?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, [animKey, startLeft, startTop, endLeft, endTop, durationMs, onComplete]);

  // Reduced motion: jump to end
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      const el = elRef.current;
      if (el) {
        el.style.left = endLeft;
        el.style.top = endTop;
      }
      if (!doneRef.current) {
        doneRef.current = true;
        onComplete?.();
      }
    }
  }, [animKey, endLeft, endTop, onComplete]);

  return (
    <div
      ref={elRef}
      className="piece-flying"
      style={{
        position: 'absolute',
        left: startLeft,
        top: startTop,
        width: '12.5%',
        height: '12.5%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 10,
        willChange: 'left, top',
      }}
    >
      <img
        className="piece-img"
        src={pieceSrc(color, type, set)}
        alt=""
        draggable={false}
        style={{ width: '90%', height: '90%', objectFit: 'contain' }}
      />
    </div>
  );
}
