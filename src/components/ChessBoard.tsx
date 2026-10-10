import React, { useCallback, useRef, useState, useEffect } from 'react';
import type { Square } from 'chess.js';
import type { Arrow, SquareHighlight } from '../chess/annotationManager';
import type { Premove } from '../chess/premoveManager';

function PieceSvg({ type, color }: { type: string; color: 'w' | 'b' }) {
  const w = color === 'w';
  const fill = w ? '#f0f0f0' : '#1f1f1f';
  const stroke = w ? '#2c2c2c' : '#0a0a0a';
  const inner = w ? '#c8c8c8' : '#3a3a3a';
  const eye = w ? '#222' : '#ddd';
  const sw = 1.15;

  const p = (d: string, extra?: React.SVGProps<SVGPathElement>) => (
    <path d={d} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" {...extra} />
  );

  let body: React.ReactNode = null;
  switch (type) {
    case 'p':
      body = (
        <>
          {p('M22.5 11c-2.4 0-4.3 1.9-4.3 4.3 0 1.3.6 2.5 1.5 3.3-2.6 1.2-4.4 3.8-4.4 6.8v.8h14.4v-.8c0-3-1.8-5.6-4.4-6.8.9-.8 1.5-2 1.5-3.3 0-2.4-1.9-4.3-4.3-4.3z')}
          {p('M13.5 28.5c0 1.8 4 3.2 9 3.2s9-1.4 9-3.2')}
          <ellipse cx="22.5" cy="35.5" rx="9.5" ry="2.2" fill={fill} stroke={stroke} strokeWidth={sw} />
          <path d="M15 28.5h15" stroke={inner} strokeWidth="1.2" fill="none" />
        </>
      );
      break;
    case 'r':
      body = (
        <>
          {p('M11.5 13h4.2v3.5h3.2V13h5.2v3.5h3.2V13h4.2v7.5l-1.8 1.8V31H13.3V22.3l-1.8-1.8V13z')}
          {p('M12.5 31h20v3.5h-20z')}
          <rect x="14.5" y="22" width="16" height="2.2" fill={inner} stroke="none" />
        </>
      );
      break;
    case 'n':
      body = (
        <>
          {p('M14 36h18v2.5H14z')}
          {p('M27 12c-1.5-1.5-4-3-7-3-2 0-4.5 1-6 3.5C12 15 11.5 18 13 21c1 2 1.5 3.5.5 5.5L11 29c-.8 1-.5 2.5 1.2 3h16.5c2 0 4-2.5 3.5-5.5-.8-5-3.5-8-5.2-10.5-1-1.5-1-2.5 0-4z')}
          <circle cx="17.5" cy="18" r="1.2" fill={eye} />
          <path d="M15 22c2 0 3.5-1 4-2" stroke={inner} strokeWidth="1" fill="none" />
        </>
      );
      break;
    case 'b':
      body = (
        <>
          <circle cx="22.5" cy="9.5" r="2" fill={fill} stroke={stroke} strokeWidth={sw} />
          {p('M22.5 12c-2.2 0-4.5 3.5-5.5 7-1.2 4-.5 8 1 11h9c1.5-3 2.2-7 1-11-1-3.5-3.3-7-5.5-7z')}
          {p('M16 30.5h13l1.5 3H14.5l1.5-3z')}
          {p('M13 35h19v3.5H13z')}
          <path d="M19.5 16l5 9" stroke={w ? '#666' : '#888'} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </>
      );
      break;
    case 'q':
      body = (
        <>
          {[12, 17, 22.5, 28, 33].map((cx, i) => (
            <circle key={i} cx={cx} cy={i === 2 ? 8.5 : 11} r={i === 2 ? 2.1 : 1.7} fill={fill} stroke={stroke} strokeWidth={sw} />
          ))}
          {p('M11.5 13.5l2.5 13h17l2.5-13-5 3.5-3.5-5.5-3.5 5.5-5-3.5z')}
          {p('M15 28h15l1.2 2.8H13.8L15 28z')}
          {p('M12.5 34h20v3.5h-20z')}
        </>
      );
      break;
    case 'k':
      body = (
        <>
          <path d="M22.5 7v6.5M19.2 10.2h6.6" stroke={stroke} strokeWidth="2.1" strokeLinecap="round" fill="none" />
          {p('M15.5 15.5c0-2.8 3-4.8 7-4.8s7 2 7 4.8c0 3.8-2.8 5.8-2.8 8.7H18.3c0-2.9-2.8-4.9-2.8-8.7z')}
          {p('M16.5 27h12l1.8 3.5H14.7L16.5 27z')}
          {p('M12.5 34h20v3.5h-20z')}
          <path d="M18.5 20h8" stroke={inner} strokeWidth="1.4" strokeLinecap="round" />
        </>
      );
      break;
  }

  return (
    <svg className="piece-svg" viewBox="0 0 45 45" aria-hidden>
      {body}
    </svg>
  );
}

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

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  const headLen = 3.2;
  const headWidth = 2.4;
  const shaftW = 1.15;

  const sx = x1 + ux * 1.5;
  const sy = y1 + uy * 1.5;
  const hx = x2 - ux * 0.4;
  const hy = y2 - uy * 0.4;
  const bx = hx - ux * headLen;
  const by = hy - uy * headLen;

  const px = -uy;
  const py = ux;

  const path = [
    `M ${sx + px * shaftW} ${sy + py * shaftW}`,
    `L ${bx + px * shaftW} ${by + py * shaftW}`,
    `L ${bx + px * headWidth} ${by + py * headWidth}`,
    `L ${hx} ${hy}`,
    `L ${bx - px * headWidth} ${by - py * headWidth}`,
    `L ${bx - px * shaftW} ${by - py * shaftW}`,
    `L ${sx - px * shaftW} ${sy - py * shaftW}`,
    'Z',
  ].join(' ');

  return <path d={path} fill={color} opacity={0.88} stroke="none" />;
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
            <div style={{ width: '94%', height: '94%', display: 'flex', opacity: dragFrom === sq ? 0.35 : 1 }}>
              <PieceSvg type={piece.type} color={piece.color} />
            </div>
          )}
          {fileLabel && <span className="coord coord-file">{fileLabel}</span>}
          {rankLabel && <span className="coord coord-rank">{rankLabel}</span>}
        </div>
      );
    }
  }

  const arrowElements = arrows.map((a, i) => (
    <ArrowPath
      key={i}
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
      <div className="board-overlay">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          {arrowElements}
        </svg>
      </div>
    </div>
  );
}
