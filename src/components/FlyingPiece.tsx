import React, { useLayoutEffect, useRef } from 'react';
import { pieceSrc, type PieceSetId } from '../chess/pieceAssets';

/** A position on the board, in percent of the board's width and height (top-left of a square-sized box). */
export interface Point {
  x: number;
  y: number;
}

const EASING = 'cubic-bezier(0.22, 0.68, 0.3, 1)';

/**
 * A piece sliding from `start` to `end` on top of the board.
 *
 * Uses the Web Animations API on left/top. When the flight is superseded or
 * unmounted, its cleanup marks it finished first, so a cancelled slide never
 * reports completion and cannot clear a newer flight.
 */
export function FlyingPiece({
  color,
  type,
  set,
  start,
  end,
  animKey,
  durationMs = 260,
  onComplete,
}: {
  color: 'w' | 'b';
  type: string;
  set: PieceSetId;
  start: Point;
  end: Point;
  animKey: number;
  durationMs?: number;
  onComplete?: () => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const sx = start.x;
  const sy = start.y;
  const ex = end.x;
  const ey = end.y;

  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el) return;

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      onComplete?.();
    };

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      finish();
      return;
    }

    let anim: Animation | null = null;
    if (typeof el.animate === 'function') {
      anim = el.animate(
        [
          { left: `${sx}%`, top: `${sy}%` },
          { left: `${ex}%`, top: `${ey}%` },
        ],
        { duration: durationMs, easing: EASING, fill: 'forwards' }
      );
      anim.onfinish = finish;
    } else {
      // Fallback for browsers without the Web Animations API: a CSS transition.
      el.style.transition = `left ${durationMs}ms ${EASING}, top ${durationMs}ms ${EASING}`;
      void el.offsetWidth;
      el.style.left = `${ex}%`;
      el.style.top = `${ey}%`;
    }
    const fallback = window.setTimeout(finish, durationMs + 80);

    return () => {
      finished = true;
      window.clearTimeout(fallback);
      anim?.cancel();
    };
  }, [animKey, sx, sy, ex, ey, durationMs, onComplete]);

  return (
    <div ref={elRef} className="piece-flying" style={{ left: `${sx}%`, top: `${sy}%` }}>
      <img className="piece-img" src={pieceSrc(color, type, set)} alt="" draggable={false} />
    </div>
  );
}
