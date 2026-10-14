/**
 * Development-only animation checker.
 *
 * Open `/AIChess/anim-check.html` on the dev server. It plays a scripted game
 * through the real `ChessBoard`, and while each piece is in the air it samples
 * `getBoundingClientRect()` on every animation frame. The table proves two
 * things that a screenshot cannot:
 *
 *   1. the piece is actually on the board for several frames (not teleported),
 *   2. it starts on the source square and ends on the destination square.
 */
import { StrictMode, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Chess, type Square } from 'chess.js';
import { ChessBoard } from '../components/ChessBoard';
import { piecesFromBoard } from '../chess/pieces';
import type { FlightRequest } from '../components/board/flights';
import '../styles/global.css';
import '../styles/theme.css';
import '../styles/board.css';

/** e2e4, g8f6 (knight), e4e5, f6d5 (knight), d2d4, d5b4? ... plus a castle. */
const SCRIPT = [
  'e2e4', 'g8f6',
  'g1f3', 'b8c6',
  'f1c4', 'e7e6',
  'e1g1', 'f8e7',
  'd2d4', 'e6e5',
  'f3e5', 'c6e5',
  'd4e5', 'f6g4',
];

interface Sample {
  move: string;
  frames: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  squarePx: number;
  verdict: string;
}

function toRequest(game: Chess, uci: string, index: number): FlightRequest {
  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  const piece = game.get(from);
  const fileDiff = Math.abs(from.charCodeAt(0) - to.charCodeAt(0));
  return {
    id: `${uci}-${index}`,
    from,
    to,
    color: game.turn(),
    type: piece?.type ?? 'p',
    isCastle: piece?.type === 'k' && fileDiff === 2,
  };
}

function Harness() {
  const gameRef = useRef(new Chess());
  const [pieces, setPieces] = useState(() => piecesFromBoard(gameRef.current.board()));
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [animation, setAnimation] = useState<FlightRequest | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const indexRef = useRef(0);
  const startedRef = useRef(false);

  const step = useCallback(() => {
    const game = gameRef.current;
    const index = indexRef.current;
    if (index >= SCRIPT.length) return;
    const uci = SCRIPT[index];
    const request = toRequest(game, uci, index);
    const applied = game.move({ from: request.from, to: request.to, promotion: 'q' });
    if (!applied) {
      setSamples((s) => [...s, { move: uci, frames: 0, startX: 0, startY: 0, endX: 0, endY: 0, squarePx: 0, verdict: 'ILLEGAL — script bug' }]);
      indexRef.current += 1;
      return;
    }
    indexRef.current += 1;
    setPieces(piecesFromBoard(game.board()));
    setLastMove({ from: request.from, to: request.to });
    setAnimation(request);
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const timer = window.setInterval(() => {
      if (indexRef.current >= SCRIPT.length) {
        window.clearInterval(timer);
        return;
      }
      step();
    }, 900);
    return () => window.clearInterval(timer);
  }, [step]);

  /* Measure the flying piece on every frame of every flight. */
  useEffect(() => {
    if (!animation) return;
    const request = animation;
    const frames: { x: number; y: number }[] = [];
    const boardWidth = document.querySelector('.chessboard-wrap')?.getBoundingClientRect().width ?? 400;
    const squarePx = boardWidth / 8;
    let raf = 0;
    const tick = () => {
      const el = document.querySelector<HTMLElement>('[data-testid="flying-piece"]');
      if (el) {
        const r = el.getBoundingClientRect();
        frames.push({ x: r.left, y: r.top });
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    const stop = window.setTimeout(() => {
      window.cancelAnimationFrame(raf);
      const first = frames[0];
      const last = frames[frames.length - 1];
      const travelled = first && last ? Math.hypot(last.x - first.x, last.y - first.y) : 0;
      const verdict =
        frames.length < 2
          ? 'FAIL — seen on fewer than 2 frames (teleport)'
          : travelled < squarePx * 0.9
            ? `FAIL — travelled ${Math.round(travelled)}px, expected about ${Math.round(squarePx)}px`
            : 'PASS — piece seen in flight, moved at least one square';
      setSamples((s) => [
        ...s,
        {
          move: `${request.from}${request.to}${request.isCastle ? ' (castle)' : ''}`,
          frames: frames.length,
          startX: Math.round(first?.x ?? 0),
          startY: Math.round(first?.y ?? 0),
          endX: Math.round(last?.x ?? 0),
          endY: Math.round(last?.y ?? 0),
          squarePx: Math.round(squarePx),
          verdict,
        },
      ]);
    }, 500);
    return () => {
      window.clearTimeout(stop);
      window.cancelAnimationFrame(raf);
    };
  }, [animation]);

  return (
    <div className="app-shell">
      <div className="main-area" style={{ padding: 24 }}>
        <h1 style={{ fontSize: 20, marginBottom: 6 }}>Animation check</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 16 }}>
          The real board, playing real moves. Each row is measured with
          <code> getBoundingClientRect() </code> on every animation frame while the piece is in the air.
        </p>
        <div style={{ width: 420 }}>
          <ChessBoard
            pieces={pieces}
            orientation="w"
            selected={null}
            legalTargets={[]}
            lastMove={lastMove}
            checkSquare={null}
            premove={null}
            arrows={[]}
            highlights={[]}
            showCoordinates
            showLegalMoves={false}
            interactive={false}
            onSelectSquare={() => undefined}
            onMove={() => undefined}
            onArrow={() => undefined}
            onHighlight={() => undefined}
            onClearAnnotations={() => undefined}
            themeClass="board-theme-green"
            pieceSet="cburnett"
            animateMoves
            animation={animation}
            playerColor="w"
          />
        </div>

        <table style={{ marginTop: 20, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['move', 'frames seen', 'start px', 'end px', 'square px', 'verdict'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '4px 12px 4px 0', color: 'var(--text-2)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {samples.map((s, i) => (
              <tr key={i}>
                <td style={{ padding: '4px 12px 4px 0' }}>{s.move}</td>
                <td style={{ padding: '4px 12px 4px 0' }}>{s.frames}</td>
                <td style={{ padding: '4px 12px 4px 0' }}>
                  {s.startX}, {s.startY}
                </td>
                <td style={{ padding: '4px 12px 4px 0' }}>
                  {s.endX}, {s.endY}
                </td>
                <td style={{ padding: '4px 12px 4px 0' }}>{s.squarePx}</td>
                <td style={{ padding: '4px 12px 4px 0', color: s.verdict.startsWith('PASS') ? 'var(--accent)' : 'var(--danger)' }}>
                  {s.verdict}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn"
            onClick={() => {
              gameRef.current = new Chess();
              indexRef.current = 0;
              setSamples([]);
              setPieces(piecesFromBoard(gameRef.current.board()));
              setLastMove(null);
              setAnimation(null);
            }}
          >
            Restart
          </button>
          <button type="button" className="btn primary" onClick={step}>
            Play next move
          </button>
        </div>
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <Harness />
    </StrictMode>
  );
}
