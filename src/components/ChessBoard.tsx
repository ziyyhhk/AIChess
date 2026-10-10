import React, { useCallback, useRef, useState, useEffect } from 'react';
import type { Square } from 'chess.js';
import type { Arrow, SquareHighlight } from '../chess/annotationManager';
import type { Premove } from '../chess/premoveManager';

function PieceSvg({ type, color }: { type: string; color: 'w' | 'b' }) {
  const isWhite = color === 'w';
  const fill = isWhite ? '#f5f5f5' : '#2a2a2a';
  const stroke = isWhite ? '#333' : '#111';
  const accent = isWhite ? '#ccc' : '#555';
  const common = { fill, stroke, strokeWidth: 1.2, strokeLinejoin: 'round' as const };

  const body = (() => {
    switch (type) {
      case 'p':
        return (
          <>
            <path {...common} d="M22.5 9c-2.2 0-4 1.8-4 4 0 1.2.5 2.3 1.4 3-2.3 1.1-3.9 3.4-3.9 6.1v1h13v-1c0-2.7-1.6-5-3.9-6.1.9-.7 1.4-1.8 1.4-3 0-2.2-1.8-4-4-4z" />
            <path {...common} d="M14 28.5v2.5c0 1.5 3.5 3 8.5 3s8.5-1.5 8.5-3v-2.5H14z" />
            <ellipse cx="22.5" cy="36" rx="10" ry="2.5" fill={accent} stroke={stroke} strokeWidth="0.8" />
          </>
        );
      case 'r':
        return (
          <>
            <path {...common} d="M12 12h5v4h3v-4h5v4h3v-4h5v8l-2 2v12H14V22l-2-2V12z" />
            <path {...common} d="M11 36h23v3H11z" />
            <rect x="14" y="22" width="17" height="3" fill={accent} stroke="none" />
          </>
        );
      case 'n':
        return (
          <>
            <path {...common} d="M22 10c-1 0-5 2-7 6-1.5 3-1 6 0 8l-3 2c-1 1-1 3 1 4l2 1v5h16v-5c3-1 5-4 4-8-1-5-5-9-9-11-1-.5-2.5-2-4-2z" />
            <circle cx="18" cy="18" r="1.3" fill={isWhite ? '#333' : '#ddd'} />
            <path {...common} d="M12 36h21v3H12z" />
          </>
        );
      case 'b':
        return (
          <>
            <path {...common} d="M22.5 8c-1.5 0-3 2-4 4-2 4-1 8 0 11 1 2 2 4 2 6h4c0-2 1-4 2-6 1-3 2-7 0-11-1-2-2.5-4-4-4z" />
            <path {...common} d="M18 29h9l2 4H16l2-4z" />
            <path {...common} d="M13 35h19v4H13z" />
            <path d="M20 14l5 8" stroke={isWhite ? '#888' : '#777'} strokeWidth="1.5" fill="none" />
            <circle cx="22.5" cy="10" r="1.8" fill={fill} stroke={stroke} strokeWidth="1" />
          </>
        );
      case 'q':
        return (
          <>
            <circle cx="12" cy="12" r="2.2" fill={fill} stroke={stroke} strokeWidth="1" />
            <circle cx="22.5" cy="9" r="2.2" fill={fill} stroke={stroke} strokeWidth="1" />
            <circle cx="33" cy="12" r="2.2" fill={fill} stroke={stroke} strokeWidth="1" />
            <circle cx="16" cy="15" r="1.8" fill={fill} stroke={stroke} strokeWidth="1" />
            <circle cx="29" cy="15" r="1.8" fill={fill} stroke={stroke} strokeWidth="1" />
            <path {...common} d="M12 14l2 12h17l2-12-5 4-3.5-6-3.5 6-5-4z" />
            <path {...common} d="M15 28h15l1 3H14l1-3z" />
            <path {...common} d="M12 35h21v4H12z" />
          </>
        );
      case 'k':
        return (
          <>
            <path stroke={stroke} strokeWidth="2" fill="none" d="M22.5 8v6M19.5 11h6" />
            <path {...common} d="M15 16c0-3 3-5 7.5-5s7.5 2 7.5 5c0 4-3 6-3 9H18c0-3-3-5-3-9z" />
            <path {...common} d="M16 27h13l2 4H14l2-4z" />
            <path {...common} d="M12 35h21v4H12z" />
            <path d="M18 20h9" stroke={accent} strokeWidth="1.5" />
          </>
        );
      default:
        return null;
    }
  })();

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
  green: '#7ac943',
  red: '#e85d5d',
  blue: '#5cb3e8',
  yellow: '#e8b84a',
};

export function ChessBoard({
  pieces, orientation, selected, legalTargets, lastMove, checkSquare,
  premove, arrows, highlights, showCoordinates, showLegalMoves, interactive,
  onSelectSquare, onMove, onArrow, onHighlight, onClearAnnotations, themeClass,
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
        'square', isLight ? 'light' : 'dark',
        isSelected ? 'selected' : '',
        lastMove?.from === sq ? 'last-from' : '',
        lastMove?.to === sq ? 'last-to' : '',
        isCheck ? 'check' : '',
        isPremove ? (premove!.from === sq ? 'premove-from' : 'premove-to') : '',
        hl ? `highlight-${hl.color}` : '',
      ].filter(Boolean).join(' ');

      const fileLabel = showCoordinates && y === 7 ? FILES[orientation === 'w' ? x : 7 - x] : null;
      const rankLabel = showCoordinates && x === 0 ? String(orientation === 'w' ? 8 - y : y + 1) : null;

      squares.push(
        <div key={sq} className={classes} data-square={sq}>
          {isLegal && !piece && <div className="legal-dot" />}
          {isLegal && piece && <div className="legal-capture" />}
          {piece && (
            <div style={{ width: '92%', height: '92%', display: 'flex', opacity: dragFrom === sq ? 0.35 : 1 }}>
              <PieceSvg type={piece.type} color={piece.color} />
            </div>
          )}
          {fileLabel && <span className="coord coord-file">{fileLabel}</span>}
          {rankLabel && <span className="coord coord-rank">{rankLabel}</span>}
        </div>
      );
    }
  }

  const arrowElements = arrows.map((a, i) => {
    const from = squareToCoords(a.from, orientation);
    const to = squareToCoords(a.to, orientation);
    const cell = 12.5;
    const x1 = (from.x + 0.5) * cell;
    const y1 = (from.y + 0.5) * cell;
    const x2 = (to.x + 0.5) * cell;
    const y2 = (to.y + 0.5) * cell;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const sx = x1 + (dx / len) * 1.2;
    const sy = y1 + (dy / len) * 1.2;
    const ex = x2 - (dx / len) * 1.8;
    const ey = y2 - (dy / len) * 1.8;
    const color = ARROW_COLORS[a.color] || ARROW_COLORS.green;
    const markerId = `ah-${a.color}-${i}`;

    return (
      <g key={i}>
        <defs>
          <marker id={markerId} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L5,2.5 L0,5 Z" fill={color} />
          </marker>
        </defs>
        <line
          x1={`${sx}%`} y1={`${sy}%`} x2={`${ex}%`} y2={`${ey}%`}
          stroke={color} strokeWidth="3.2%" strokeLinecap="round" opacity={0.9}
          markerEnd={`url(#${markerId})`}
        />
      </g>
    );
  });

  return (
    <div
      ref={wrapRef}
      className={`chessboard-wrap ${themeClass}`}
      onMouseDown={handlePointerDown}
      onMouseUp={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
      onMouseLeave={() => { setDragFrom(null); setRightDragFrom(null); }}
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
