import React, { useLayoutEffect, useRef } from 'react';
import { pieceSrc, type PieceSetId } from '../chess/pieceAssets';
import { flightTransform, type SquarePoint } from './board/flights';

const EASING = 'cubic-bezier(0.25, 0.72, 0.28, 1)';

/**
 * One chess piece travelling from `start` to `end`.
 *
 * The element occupies exactly one square at the board's top-left corner and is
 * moved with `transform: translate3d(...)`. Translating by percentages of the
 * element's own size means one square of travel is exactly `100%`, so the path
 * is identical at every board size and needs no measuring.
 *
 * The piece is unmounted when it arrives. When it is unmounted early (a new
 * move supersedes it, the board is flipped, the game is reset) the animation is
 * cancelled and completion is *not* reported, so a cancelled slide can never
 * clear a newer one.
 */
export function FlyingPiece({
  flightId,
  color,
  type,
  set,
  from,
  to,
  start,
  end,
  durationMs,
  delayMs = 0,
  onArrive,
}: {
  flightId: string;
  color: 'w' | 'b';
  type: string;
  set: PieceSetId;
  from: string;
  to: string;
  start: SquarePoint;
  end: SquarePoint;
  durationMs: number;
  delayMs?: number;
  onArrive: (flightId: string) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const arrivedRef = useRef(false);

  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el) return;
    arrivedRef.current = false;

    const arrive = () => {
      if (arrivedRef.current) return;
      arrivedRef.current = true;
      onArrive(flightId);
    };

    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion || durationMs <= 0) {
      el.style.transform = flightTransform(end);
      arrive();
      return;
    }

    let animation: Animation | null = null;
    if (typeof el.animate === 'function') {
      animation = el.animate(
        [
          { transform: flightTransform(start) },
          { transform: flightTransform(end) },
        ],
        { duration: durationMs, delay: delayMs, easing: EASING, fill: 'forwards' }
      );
      animation.onfinish = arrive;
    } else {
      // Very old browsers: fall back to a CSS transition that still moves the
      // real piece, and settle it with a timer.
      el.style.transition = `transform ${durationMs}ms ${EASING}`;
      el.style.transform = flightTransform(end);
    }

    // Safety net: if the animation event never fires, settle the piece anyway so
    // the board can never be left with a hidden square.
    const fallback = window.setTimeout(arrive, durationMs + delayMs + 120);

    return () => {
      window.clearTimeout(fallback);
      animation?.cancel();
    };
  }, [flightId, start, start.x, start.y, end, end.x, end.y, durationMs, delayMs, onArrive]);

  return (
    <div
      ref={elRef}
      className="piece-flying"
      data-testid="flying-piece"
      data-flight-id={flightId}
      data-from={from}
      data-to={to}
      aria-hidden="true"
      style={{ transform: flightTransform(start) }}
    >
      <img className="piece-img" src={pieceSrc(color, type, set)} alt="" draggable={false} />
    </div>
  );
}
