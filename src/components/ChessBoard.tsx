import React, { useCallback, useRef, useState, useEffect } from 'react';
import type { Square } from 'chess.js';
import type { Arrow, SquareHighlight } from '../chess/annotationManager';
import type { Premove } from '../chess/premoveManager';

const UNICODE: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};
const FILES = 'abcdefgh';

interface BoardPiece { type: string; color: 'w' | 'b'; square: Square; }

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
            <span className={`piece ${dragFrom === sq ? 'dragging' : ''}`}
              style={{ color: piece.color === 'w' ? '#f5f5f5' : '#111' }}>
              {UNICODE[`${piece.color}${piece.type.toUpperCase()}`] || '?'}
            </span>
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
    const cx = (n: number) => (n + 0.5) * 12.5;
    return (
      <line key={i} x1={`${cx(from.x)}%`} y1={`${cx(from.y)}%`}
        x2={`${cx(to.x)}%`} y2={`${cx(to.y)}%`}
        className={`arrow-${a.color}`} strokeWidth="2.2%" strokeLinecap="round"
        markerEnd="url(#arrowhead)" opacity={0.85} />
    );
  });

  return (
    <div ref={wrapRef} className={`chessboard-wrap ${themeClass}`}
      onMouseDown={handlePointerDown} onMouseUp={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
      onMouseLeave={() => { setDragFrom(null); setRightDragFrom(null); }}>
      <div className="chessboard">{squares}</div>
      <div className="board-overlay">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <marker id="arrowhead" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
              <path d="M0,0 L4,2 L0,4 Z" fill="currentColor" />
            </marker>
          </defs>
          {arrowElements}
        </svg>
      </div>
    </div>
  );
}
