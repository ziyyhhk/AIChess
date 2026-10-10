import React, { useCallback, useRef, useState, useEffect } from 'react';
import type { Square } from 'chess.js';
import type { Arrow, SquareHighlight } from '../chess/annotationManager';
import type { Premove } from '../chess/premoveManager';
import { pieceSrc, type PieceSetId } from '../chess/pieceAssets';

const FILES = 'abcdefgh';

interface BoardPiece {
  type: string;
  color: 'w' | 'b';
  square: Square;
}

interface Props {
  pieces: BoardPiece[];
  orientation: 'w' | 'b';
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
  onMove: (from: Square, to: Square) => void;
  onArrow: (from: Square, to: Square) => void;
  onHighlight: (sq: Square) => void;
  onClearAnnotations: () => void;
  themeClass: string;
  pieceSet?: PieceSetId;
}

function squareToCoords(sq: Square, orientation: 'w' | 'b') {
  const file = sq.charCodeAt(0) - 97;
  const rank = parseInt(sq[1], 10) - 1;
  return {
    x: orientation === 'w' ? file : 7 - file,
    y: orientation === 'w' ? 7 - rank : rank,
  };
}

function coordsToSquare(x: number, y: number, orientation: 'w' | 'b'): Square {
  const file = orientation === 'w' ? x : 7 - x;
  const rank = orientation === 'w' ? 7 - y : y;
  return (String.fromCharCode(97 + file) + (rank + 1)) as Square;
}

const ARROW_COLORS: Record<string, string> = {
  green: '#96d45b',
  red: '#f05c5c',
  blue: '#5cb8e8',
  yellow: '#e8b84a',
};

function isKnightDelta(dx: number, dy: number) {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  return (ax === 2 && ay === 1) || (ax === 1 && ay === 2);
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

  const out: { x: number; y: number }[] = points.map((p) => ({ ...p }));
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
  const base = {
    x: lastB.x - ux * headLen,
    y: lastB.y - uy * headLen,
  };

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
      style={{ opacity: dimmed ? 0.35 : 1 }}
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
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dragFrom, setDragFrom] = useState<Square | null>(null);
  const [rightDragFrom, setRightDragFrom] = useState<Square | null>(null);

  const getSquareFromEvent = useCallback(
    (e: React.MouseEvent | MouseEvent): Square | null => {
      const el = wrapRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const x = Math.floor(((e.clientX - rect.left) / rect.width) * 8);
      const y = Math.floor(((e.clientY - rect.top) / rect.height) * 8);
      if (x < 0 || x > 7 || y < 0 || y > 7) return null;
      return coordsToSquare(x, y, orientation);
    },
    [orientation]
  );

  const handlePointerDown = (e: React.MouseEvent) => {
    if (!interactive) return;

    if (e.button === 2) {
      e.preventDefault();
      const sq = getSquareFromEvent(e);
      if (sq) setRightDragFrom(sq);
      return;
    }
    if (e.button !== 0) return;

    // Left-click clears all arrows/highlights (Chess.com behavior), then normal play
    onClearAnnotations();

    const sq = getSquareFromEvent(e);
    if (!sq) return;
    const piece = pieces.find((p) => p.square === sq);
    if (piece) {
      setDragFrom(sq);
      onSelectSquare(sq);
    } else if (selected) {
      onMove(selected, sq);
    } else {
      onSelectSquare(sq);
    }
  };

  const handlePointerUp = (e: React.MouseEvent) => {
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
    if (dragFrom) {
      const to = getSquareFromEvent(e);
      if (to && to !== dragFrom) onMove(dragFrom, to);
      setDragFrom(null);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClearAnnotations();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClearAnnotations]);

  const squares: React.ReactNode[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const sq = coordsToSquare(x, y, orientation);
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

      squares.push(
        <div key={sq} className={classes} data-square={sq}>
          {isLegal && !piece && <div className="legal-dot" />}
          {isLegal && piece && <div className="legal-capture" />}
          {piece && (
            <PieceImg
              color={piece.color}
              type={piece.type}
              set={pieceSet}
              dimmed={dragFrom === sq}
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
      className={`chessboard-wrap ${themeClass}`}
      onMouseDown={handlePointerDown}
      onMouseUp={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
      onMouseLeave={() => {
        setDragFrom(null);
        setRightDragFrom(null);
      }}
    >
      <div className="chessboard">{squares}</div>
      <div className="board-overlay" aria-hidden>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          {arrowElements}
        </svg>
      </div>
    </div>
  );
}
