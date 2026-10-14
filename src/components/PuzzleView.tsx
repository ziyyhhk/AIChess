import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { ChessBoard } from './ChessBoard';
import { piecesFromFen, kingInCheckSquare } from '../chess/pieces';
import type { PieceSetId } from '../chess/pieceAssets';
import { PUZZLE_CATALOG, type PuzzleDef } from '../puzzles/catalog';
import {
  applySolutionStep,
  filterValidPuzzles,
  isAcceptedMove,
  validatePuzzle,
} from '../puzzles/validate';
import {
  applyAttempt,
  loadPuzzleStats,
  savePuzzleStats,
  type PlayerPuzzleStats,
} from '../puzzles/rating';
import { soundManager } from '../audio/soundManager';
import type { FlightRequest } from './board/flights';

interface Props {
  pieceTheme: PieceSetId;
  boardThemeClass: string;
  showCoordinates: boolean;
  enableSounds: boolean;
}

type Feedback = 'none' | 'wrong' | 'correct' | 'solved';

function pickPuzzle(excludeId?: string): PuzzleDef | null {
  const valid = filterValidPuzzles(PUZZLE_CATALOG);
  if (!valid.length) return null;
  const pool = excludeId ? valid.filter((p) => p.id !== excludeId) : valid;
  const list = pool.length ? pool : valid;
  return list[Math.floor(Math.random() * list.length)] ?? null;
}

export function PuzzleView({
  pieceTheme,
  boardThemeClass,
  showCoordinates,
  enableSounds,
}: Props) {
  const [stats, setStats] = useState<PlayerPuzzleStats>(() => loadPuzzleStats());
  const [puzzle, setPuzzle] = useState<PuzzleDef | null>(null);
  const [fen, setFen] = useState('');
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Square | null>(null);
  const [feedback, setFeedback] = useState<Feedback>('none');
  const [wrongCount, setWrongCount] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintText, setHintText] = useState<string | null>(null);
  const [animation, setAnimation] = useState<FlightRequest | null>(null);
  const [animCounter, setAnimCounter] = useState(0);

  const resetWith = useCallback((p: PuzzleDef | null) => {
    setPuzzle(p);
    setFen(p?.fen ?? '');
    setStep(0);
    setSelected(null);
    setFeedback('none');
    setWrongCount(0);
    setHintsUsed(0);
    setHintText(null);
    setAnimation(null);
  }, []);

  useEffect(() => {
    resetWith(pickPuzzle());
  }, [resetWith]);

  const chess = useMemo(() => {
    try {
      return new Chess(fen || undefined);
    } catch {
      return new Chess();
    }
  }, [fen]);

  const pieces = useMemo(() => (fen ? piecesFromFen(fen) : []), [fen]);
  const checkSq = useMemo(() => (fen ? kingInCheckSquare(fen) : null), [fen]);
  const legalTargets = useMemo(() => {
    if (!selected || !fen) return [] as Square[];
    return chess.moves({ square: selected, verbose: true }).map((m) => m.to as Square);
  }, [selected, chess, fen]);

  const finishSolved = useCallback(
    (p: PuzzleDef, wrongs: number, hints: number) => {
      setFeedback('solved');
      if (enableSounds) soundManager.play('gameWin');
      const next = applyAttempt(stats, {
        puzzleId: p.id,
        puzzleRating: p.rating,
        solved: true,
        incorrectAttempts: wrongs,
        hintsUsed: hints,
      });
      setStats(next);
      savePuzzleStats(next);
    },
    [stats, enableSounds]
  );

  const tryMove = (from: Square, to: Square) => {
    if (!puzzle || feedback === 'solved') return;
    const fullUci = `${from}${to}`;

    if (!isAcceptedMove(puzzle, step, fullUci) && !isAcceptedMove(puzzle, step, fullUci + 'q')) {
      const test = new Chess(fen);
      const legal = test.move({ from, to, promotion: 'q' });
      if (!legal) {
        if (enableSounds) soundManager.play('illegal');
        return;
      }
      setFeedback('wrong');
      setWrongCount((c) => c + 1);
      if (enableSounds) soundManager.play('illegal');
      window.setTimeout(() => {
        setFeedback('none');
        setSelected(null);
      }, 700);
      return;
    }

    const stepDef = puzzle.solution[step];
    const piece = chess.get(from);
    const nextId = animCounter + 1;
    setAnimCounter(nextId);
    setAnimation({
      id: `pz-${nextId}`,
      from,
      to,
      color: piece?.color ?? puzzle.sideToMove,
      type: piece?.type ?? 'p',
      isCastle: false,
    });
    if (enableSounds) soundManager.play('moveSelf');
    setFeedback('correct');

    const applied = applySolutionStep(fen, {
      uci: stepDef.uci,
      replyUci: stepDef.replyUci,
    });
    if (!applied.ok) {
      setFeedback('wrong');
      return;
    }

    const nextStep = step + 1;
    setFen(applied.fen);
    setStep(nextStep);
    setSelected(null);
    if (nextStep >= puzzle.solution.length) {
      finishSolved(puzzle, wrongCount, hintsUsed);
    } else {
      window.setTimeout(() => setFeedback('none'), 400);
    }
  };

  const onSelectSquare = (sq: Square) => {
    if (feedback === 'solved') return;
    const piece = chess.get(sq);
    if (selected) {
      if (selected === sq) {
        setSelected(null);
        return;
      }
      tryMove(selected, sq);
      return;
    }
    if (piece && piece.color === chess.turn()) setSelected(sq);
  };

  const onHint = () => {
    if (!puzzle) return;
    const stepDef = puzzle.solution[step];
    if (!stepDef) return;
    const nextHints = hintsUsed + 1;
    setHintsUsed(nextHints);
    if (nextHints === 1) {
      setHintText(`Theme: ${puzzle.theme}. ${puzzle.objective}.`);
    } else if (nextHints === 2) {
      setHintText(`Consider the piece on ${stepDef.uci.slice(0, 2)}.`);
    } else {
      setHintText(`Try ${stepDef.uci.slice(0, 2)} → ${stepDef.uci.slice(2, 4)}.`);
    }
  };

  if (!puzzle) {
    return (
      <div className="view puzzle-view">
        <h1>Puzzles</h1>
        <p className="gp-muted">Loading puzzles…</p>
      </div>
    );
  }

  const validation = validatePuzzle(puzzle);

  return (
    <div className="view puzzle-view">
      <header className="view-head">
        <div>
          <h1>Puzzles</h1>
          <p>
            Engine-validated tactics. Wrong moves show an X — you can retry. Rating updates from real
            attempts only.
          </p>
        </div>
        <div className="puzzle-rating-card">
          <span className="accuracy-value">{stats.rating}</span>
          <span className="gp-muted">
            Rating · {stats.solved} solved · streak {stats.bestStreak}
          </span>
        </div>
      </header>

      <div className="puzzle-layout">
        <div className="puzzle-board-col">
          <div className={`puzzle-feedback-banner is-${feedback}`} aria-live="polite">
            {feedback === 'wrong' && <span className="puzzle-x">Incorrect — try again</span>}
            {feedback === 'correct' && <span className="puzzle-ok">Correct</span>}
            {feedback === 'solved' && <span className="puzzle-ok">Puzzle complete</span>}
          </div>
          <ChessBoard
            pieces={pieces}
            orientation={puzzle.sideToMove}
            selected={selected}
            legalTargets={legalTargets}
            lastMove={null}
            checkSquare={checkSq}
            premove={null}
            arrows={[]}
            highlights={[]}
            showCoordinates={showCoordinates}
            showLegalMoves
            interactive={feedback !== 'solved'}
            onSelectSquare={onSelectSquare}
            onMove={(from, to) => tryMove(from, to)}
            onArrow={() => undefined}
            onHighlight={() => undefined}
            onClearAnnotations={() => undefined}
            themeClass={boardThemeClass}
            pieceSet={pieceTheme}
            animateMoves
            animation={animation}
            playerColor={puzzle.sideToMove}
          />
        </div>

        <aside className="puzzle-side card">
          <h2 className="card-title">{puzzle.objective}</h2>
          <p className="gp-muted">{puzzle.source}</p>
          <dl className="analysis-facts">
            <div>
              <dt>Side to move</dt>
              <dd>{puzzle.sideToMove === 'w' ? 'White' : 'Black'}</dd>
            </div>
            <div>
              <dt>Difficulty</dt>
              <dd>{puzzle.rating}</dd>
            </div>
            <div>
              <dt>Progress</dt>
              <dd>
                {Math.min(step + 1, puzzle.solution.length)} / {puzzle.solution.length}
              </dd>
            </div>
            <div>
              <dt>Wrong tries</dt>
              <dd>{wrongCount}</dd>
            </div>
          </dl>
          {hintText && <p className="gp-hint-status">{hintText}</p>}
          <div className="puzzle-actions">
            <button type="button" className="btn" onClick={onHint} disabled={feedback === 'solved'}>
              Hint
            </button>
            <button type="button" className="btn" onClick={() => resetWith(puzzle)}>
              Restart
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setFeedback('solved');
                setHintText(`Solution: ${puzzle.solution.map((s) => s.uci).join(', ')}`);
                const next = applyAttempt(stats, {
                  puzzleId: puzzle.id,
                  puzzleRating: puzzle.rating,
                  solved: false,
                  incorrectAttempts: wrongCount + 1,
                  hintsUsed,
                });
                setStats(next);
                savePuzzleStats(next);
              }}
              disabled={feedback === 'solved'}
            >
              Reveal
            </button>
            <button type="button" className="btn primary" onClick={() => resetWith(pickPuzzle(puzzle.id))}>
              Next puzzle
            </button>
          </div>
          <p className="gp-muted" style={{ marginTop: 12 }}>
            {validation.ok ? 'Solution verified' : validation.reason}
          </p>
        </aside>
      </div>
    </div>
  );
}
