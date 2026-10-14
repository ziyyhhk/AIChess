import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Square } from 'chess.js';
import type { Arrow, SquareHighlight } from '../chess/annotationManager';
import type { Premove } from '../chess/premoveManager';
import { pieceSrc, type PieceSetId } from '../chess/pieceAssets';
import { FlyingPiece } from './FlyingPiece';
import {
  buildFlights,
  FILES,
  isKnightDelta,
  flightTransform,
  pointToSquare,
  pointerToPoint,
  pointerToSquare,
  squareToPoint,
  type Flight,
  type FlightRequest,
  type Orientation,
  type SquarePoint,
} from './board/flights';

/** How long a piece slides across the board, in ms. Long enough to read as a glide. */
export const MOVE_ANIMATION_MS = 260;

const CELL = 12.5; // one square, as a percentage of the board
const HALF_CELL = CELL / 2;
/** Never keep more than this many overlays alive at once. */
const MAX_ACTIVE_FLIGHTS = 4;

interface BoardPiece {
  type: string;
  color: 'w' | 'b';
  square: Square;
}

interface DragState {
  from: Square;
  color: 'w' | 'b';
  type: string;
  /** Top-left of the dragged piece, in square units. */
  point: SquarePoint;
}

interface Props {
  pieces: BoardPiece[];
  orientation: Orientation;
  selected: Square | null;
  legalTargets: Square[];
  lastMove: { from: Square; to: Square } | null;
  checkSquare: Square | null;
  premove: Premove | null;
  arrows: Arrow[];
  highlights: SquareHighlight[];
  showCoordinates: boolean;
  showLegalMoves: boolean;
  interactive: boolean;
  onSelectSquare: (sq: Square) => void;
  /** `dropPoint` is where a dragged piece was released, in square units. */
  onMove: (from: Square, to: Square, dropPoint?: SquarePoint) => void;
  onArrow: (from: Square, to: Square) => void;
  onHighlight: (sq: Square) => void;
  onClearAnnotations: () => void;
  themeClass: string;
  pieceSet?: PieceSetId;
  animateMoves?: boolean;
  /**
   * The move to animate. Built by the app's move pipeline, so the animation
   * always describes the move the rules engine actually executed.
   */
  animation: FlightRequest | null;
  /** Fired once the piece has finished travelling (or immediately if not animated). */
  onAnimationSettled?: (moveId: string) => void;
  /** The side the human plays. Only its pieces can be dragged. */
  playerColor?: 'w' | 'b';
}

const ARROW_COLORS: Record<string, string> = {
  green: '#96d45b',
  red: '#f05c5c',
  blue: '#5cb8e8',
  yellow: '#e8b84a',
};

function squareToCoords(sq: Square, orientation: Orientation) {
  const p = squareToPoint(sq, orientation);
  return { x: p.x, y: p.y };
}

function ArrowPath({
  from,
  to,
  color,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
}) {
  const cell = 12.5;
  const x1 = (from.x + 0.5) * cell;
  const y1 = (from.y + 0.5) * cell;
  const x2 = (to.x + 0.5) * cell;
  const y2 = (to.y + 0.5) * cell;
  const gridDx = to.x - from.x;
  const gridDy = to.y - from.y;
  const knight = isKnightDelta(gridDx, gridDy);
  const headLen = 2.8;
  const headWidth = 2.1;
  const shaftW = 0.95;
  let points: { x: number; y: number }[];
  if (knight) {
    const ax = Math.abs(gridDx);
    let midX: number;
    let midY: number;
    if (ax === 2) {
      midX = (from.x + Math.sign(gridDx) * 2 + 0.5) * cell;
      midY = y1;
    } else {
      midX = x1;
      midY = (from.y + Math.sign(gridDy) * 2 + 0.5) * cell;
    }
    points = [
      { x: x1, y: y1 },
      { x: midX, y: midY },
      { x: x2, y: y2 },
    ];
  } else {
    points = [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ];
  }
  const out = points.map((p) => ({ ...p }));
  {
    const a = out[0];
    const b = out[1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    a.x += (dx / len) * 1.2;
    a.y += (dy / len) * 1.2;
  }
  {
    const n = out.length;
    const a = out[n - 2];
    const b = out[n - 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    b.x -= (dx / len) * 0.3;
    b.y -= (dy / len) * 0.3;
  }
  const n = out.length;
  const lastA = out[n - 2];
  const lastB = out[n - 1];
  const ldx = lastB.x - lastA.x;
  const ldy = lastB.y - lastA.y;
  const llen = Math.sqrt(ldx * ldx + ldy * ldy) || 1;
  const ux = ldx / llen;
  const uy = ldy / llen;
  const px = -uy;
  const py = ux;
  const tip = { x: lastB.x, y: lastB.y };
  const base = { x: lastB.x - ux * headLen, y: lastB.y - uy * headLen };
  const shaftPts = out.slice(0, -1).concat([base]);
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i < shaftPts.length; i++) {
    const p0 = shaftPts[Math.max(0, i - 1)];
    const p1 = shaftPts[i];
    const p2 = shaftPts[Math.min(shaftPts.length - 1, i + 1)];
    let dx = p2.x - p0.x;
    let dy = p2.y - p0.y;
    if (i === 0) {
      dx = p2.x - p1.x;
      dy = p2.y - p1.y;
    } else if (i === shaftPts.length - 1) {
      dx = p1.x - p0.x;
      dy = p1.y - p0.y;
    }
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    left.push(`${p1.x + nx * shaftW} ${p1.y + ny * shaftW}`);
    right.push(`${p1.x - nx * shaftW} ${p1.y - ny * shaftW}`);
  }
  const pathD = [
    `M ${left[0]}`,
    ...left.slice(1).map((p) => `L ${p}`),
    `L ${base.x + px * headWidth} ${base.y + py * headWidth}`,
    `L ${tip.x} ${tip.y}`,
    `L ${base.x - px * headWidth} ${base.y - py * headWidth}`,
    ...right
      .slice()
      .reverse()
      .map((p) => `L ${p}`),
    'Z',
  ].join(' ');
  return <path d={pathD} fill={color} opacity={0.9} stroke="none" />;
}

function PieceImg({
  color,
  type,
  set,
  dimmed,
}: {
  color: 'w' | 'b';
  type: string;
  set: PieceSetId;
  dimmed?: boolean;
}) {
  return (
    <img
      className="piece-img"
      src={pieceSrc(color, type, set)}
      alt=""
      draggable={false}
      style={{ opacity: dimmed ? 0.28 : 1 }}
    />
  );
}

export function ChessBoard({
  pieces,
  orientation,
  selected,
  legalTargets,
  lastMove,
  checkSquare,
  premove,
  arrows,
  highlights,
  showCoordinates,
  showLegalMoves,
  interactive,
  onSelectSquare,
  onMove,
  onArrow,
  onHighlight,
  onClearAnnotations,
  themeClass,
  pieceSet = 'cburnett',
  animateMoves = true,
  animation,
  onAnimationSettled,
  playerColor,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [rightDragFrom, setRightDragFrom] = useState<Square | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const seenAnimationRef = useRef<string | null>(null);
  const settledRef = useRef<Set<string>>(new Set());
  const ownColor = playerColor ?? orientation;

  const reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The app's settle callback is read through a ref, so `settle` keeps one identity
  // and a parent re-render can never re-run the move effect mid-slide.
  const onAnimationSettledRef = useRef(onAnimationSettled);
  onAnimationSettledRef.current = onAnimationSettled;
  const settle = useCallback((moveId: string) => {
    if (settledRef.current.has(moveId)) return;
    settledRef.current.add(moveId);
    onAnimationSettledRef.current?.(moveId);
  }, []);

  /**
   * Start (or skip) the animation for a newly committed move.
   *
   * This runs as a layout effect so the travelling piece exists in the same
   * frame in which the new position is first painted. Without that, the piece
   * would appear on its destination square for one frame - the "teleport" that
   * the old implementation showed.
   */
  useLayoutEffect(() => {
    if (!animation) {
      seenAnimationRef.current = null;
      settledRef.current.clear();
      setFlights((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    if (seenAnimationRef.current === animation.id) return;
    seenAnimationRef.current = animation.id;
    settledRef.current.delete(animation.id);

    const planned = buildFlights(animation, orientation, MOVE_ANIMATION_MS);
    if (!animateMoves || reduceMotion || planned.length === 0) {
      setFlights((prev) => (prev.length === 0 ? prev : []));
      settle(animation.id);
      return;
    }

    setFlights((prev) => {
      const keep = prev.filter((f) => f.requestId !== animation.id);
      return [...keep, ...planned].slice(-MAX_ACTIVE_FLIGHTS);
    });

    // Whatever happens to the overlay (a newer move, an unmount, a pruned
    // flight), the app is told when this move is visually done. The premove
    // queue depends on that and must never stall.
    const guard = window.setTimeout(() => settle(animation.id), MOVE_ANIMATION_MS + 250);
    return () => window.clearTimeout(guard);
  }, [animation, orientation, animateMoves, reduceMotion, settle]);

  // The current flights, readable without making the state updater impure.
  const flightsRef = useRef<Flight[]>([]);
  useEffect(() => {
    flightsRef.current = flights;
  }, [flights]);

  const handleArrive = useCallback(
    (flightId: string) => {
      const current = flightsRef.current;
      const flight = current.find((f) => f.id === flightId);
      if (!flight) return;
      const next = current.filter((f) => f.id !== flightId);
      flightsRef.current = next;
      setFlights(next);
      // Every flight of this move has landed.
      if (!next.some((f) => f.requestId === flight.requestId)) settle(flight.requestId);
    },
    [settle]
  );

  const pointerToBoardPoint = useCallback(
    (clientX: number, clientY: number): SquarePoint | null => {
      const el = wrapRef.current;
      if (!el) return null;
      return pointerToPoint(clientX, clientY, el.getBoundingClientRect(), orientation);
    },
    [orientation]
  );

  const getSquareFromEvent = useCallback(
    (e: React.MouseEvent | MouseEvent): Square | null => {
      const el = wrapRef.current;
      if (!el) return null;
      return pointerToSquare(e.clientX, e.clientY, el.getBoundingClientRect(), orientation);
    },
    [orientation]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!interactive) return;
    if (e.button === 2) {
      e.preventDefault();
      const sq = getSquareFromEvent(e);
      if (sq) setRightDragFrom(sq);
      return;
    }
    if (e.button !== 0) return;
    onClearAnnotations();
    const sq = getSquareFromEvent(e);
    if (!sq) return;
    const piece = pieces.find((p) => p.square === sq);
    if (piece) {
      onSelectSquare(sq);
      if (piece.color === ownColor) {
        const point = pointerToBoardPoint(e.clientX, e.clientY);
        if (point) setDrag({ from: sq, color: piece.color, type: piece.type, point });
      }
    } else if (selected) {
      onMove(selected, sq);
    } else {
      onSelectSquare(sq);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drag) return;
    const point = pointerToBoardPoint(e.clientX, e.clientY);
    if (point) setDrag((d) => (d ? { ...d, point } : d));
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.button === 2) {
      e.preventDefault();
      const to = getSquareFromEvent(e);
      if (rightDragFrom && to) {
        if (rightDragFrom === to) onHighlight(to);
        else onArrow(rightDragFrom, to);
      }
      setRightDragFrom(null);
      return;
    }
    if (!drag) return;
    const to = getSquareFromEvent(e);
    if (to && to !== drag.from) {
      // Released mid-drag: the piece slides on from where the pointer let go.
      onMove(drag.from, to, drag.point);
    }
    setDrag(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClearAnnotations();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClearAnnotations]);

  const hiddenSquares = new Set(flights.map((f) => f.to as string));
  const premovePiece = premove ? pieces.find((p) => p.square === premove.from) : undefined;

  const squares: React.ReactNode[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const sq = pointToSquare({ x, y }, orientation);
      const isLight = (x + y) % 2 === 0;
      const piece = pieces.find((p) => p.square === sq);
      const isSelected = selected === sq;
      const isLegal = showLegalMoves && legalTargets.includes(sq);
      const isCheck = checkSquare === sq;
      const isPremove = premove && (premove.from === sq || premove.to === sq);
      const hl = highlights.find((h) => h.square === sq);
      const classes = [
        'square',
        isLight ? 'light' : 'dark',
        isSelected ? 'selected' : '',
        lastMove?.from === sq ? 'last-from' : '',
        lastMove?.to === sq ? 'last-to' : '',
        isCheck ? 'check' : '',
        isPremove ? (premove!.from === sq ? 'premove-from' : 'premove-to') : '',
        hl ? `highlight-${hl.color}` : '',
      ]
        .filter(Boolean)
        .join(' ');
      const fileLabel = showCoordinates && y === 7 ? FILES[orientation === 'w' ? x : 7 - x] : null;
      const rankLabel = showCoordinates && x === 0 ? String(orientation === 'w' ? 8 - y : y + 1) : null;
      const isPremoveTarget = !!premove && !!premovePiece && premove.to === sq;
      squares.push(
        <div key={sq} className={classes} data-square={sq}>
          {isLegal && !piece && <div className="legal-dot" />}
          {isLegal && piece && <div className="legal-capture" />}
          {piece && !hiddenSquares.has(sq) && (
            <PieceImg
              color={piece.color}
              type={piece.type}
              set={pieceSet}
              dimmed={drag?.from === sq}
            />
          )}
          {isPremoveTarget && premovePiece && (
            <img
              className="piece-img piece-premove-ghost"
              src={pieceSrc(premovePiece.color, premovePiece.type, pieceSet)}
              alt=""
              draggable={false}
            />
          )}
          {fileLabel && <span className="coord coord-file">{fileLabel}</span>}
          {rankLabel && <span className="coord coord-rank">{rankLabel}</span>}
        </div>
      );
    }
  }

  const arrowElements = arrows.map((a, i) => (
    <ArrowPath
      key={`${a.from}-${a.to}-${a.color}-${i}`}
      from={squareToCoords(a.from, orientation)}
      to={squareToCoords(a.to, orientation)}
      color={ARROW_COLORS[a.color] || ARROW_COLORS.green}
    />
  ));

  return (
    <div
      ref={wrapRef}
      className={`chessboard-wrap ${themeClass}${drag ? ' is-dragging' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      onMouseLeave={() => {
        setDrag(null);
        setRightDragFrom(null);
      }}
    >
      <div className="chessboard">{squares}</div>
      {flights.length > 0 && (
        <div className="piece-flying-layer" data-testid="flying-layer" aria-hidden>
          {flights.map((f) => (
            <FlyingPiece
              key={f.id}
              flightId={f.id}
              color={f.color}
              type={f.type}
              set={pieceSet}
              from={f.from}
              to={f.to}
              start={f.start}
              end={f.end}
              durationMs={MOVE_ANIMATION_MS}
              delayMs={f.delayMs}
              onArrive={handleArrive}
            />
          ))}
        </div>
      )}
      {drag && (
        <div
          className="piece-drag-ghost"
          aria-hidden
          data-testid="drag-ghost"
          style={{ transform: flightTransform(drag.point) }}
        >
          <img
            className="piece-img"
            src={pieceSrc(drag.color, drag.type, pieceSet)}
            alt=""
            draggable={false}
          />
        </div>
      )}
      <div className="board-overlay" aria-hidden>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          {arrowElements}
        </svg>
      </div>
    </div>
  );
}

/* Keep the constant used by older imports meaningful. */
export const ANIMATION_HALF_CELL = HALF_CELL;
