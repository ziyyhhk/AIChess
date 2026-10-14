import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Square } from 'chess.js';
import { ChessBoard } from './ChessBoard';
import { MoveGlyph } from './analysis/MoveGlyph';
import { EvalGraph } from './analysis/EvalGraph';
import { piecesFromFen, kingInCheckSquare } from '../chess/pieces';
import { formatEvaluation, type AnalyzedPly } from '../analysis/analyzeGame';
import { CLASSIFICATION_LABEL, type MoveClassification } from '../analysis/classification';
import {
  CLASSIFICATION_ICONS,
  loadIconOverrides,
  type IconManifest,
} from '../analysis/iconAssets';
import type { AnalysisRunState } from '../analysis/runState';
import { RatingTierIcon } from '../ui/RatingTierIcon';
import type { PieceSetId } from '../chess/pieceAssets';
import type { FlightRequest } from './board/flights';
import {
  arrowsForPly,
  plyToAnimation,
  SPEED_OPTIONS,
  START_FEN,
  SUGGEST_FOR,
} from '../analysis/replayHelpers';

const DEPTH_CHOICES = [8, 10, 12, 14, 16, 18];

export interface AnalysisViewProps {
  state: AnalysisRunState;
  livePlyCount: number;
  depth: number;
  onDepthChange: (depth: number) => void;
  onAnalyze: () => void;
  onAnalyzePgn?: (pgn: string) => void;
  onCancel: () => void;
  onSelectPly: (ply: number | null) => void;
  onReturnToGame: () => void;
  pieceTheme: PieceSetId;
  boardThemeClass: string;
  showCoordinates: boolean;
  showLegalMoves: boolean;
}

export function AnalysisView({
  state,
  livePlyCount,
  depth,
  onDepthChange,
  onAnalyze,
  onAnalyzePgn,
  onCancel,
  onSelectPly,
  onReturnToGame,
  pieceTheme,
  boardThemeClass,
  showCoordinates,
}: AnalysisViewProps) {
  const [overrides, setOverrides] = useState<IconManifest>({});
  const [pgnText, setPgnText] = useState('');
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [reviewAnim, setReviewAnim] = useState<FlightRequest | null>(null);
  const [autoStartedFor, setAutoStartedFor] = useState<string | null>(null);
  const animCounter = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    loadIconOverrides()
      .then((map) => {
        if (active) setOverrides(map);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const plies = state.result?.plies ?? [];
  const summary = state.result?.summary ?? null;
  const selected =
    state.selectedPly != null ? plies.find((p) => p.ply === state.selectedPly) ?? null : null;
  const total = state.progress?.total ?? 0;
  const completed = state.progress?.completed ?? 0;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const stale = summary != null && livePlyCount !== state.livePliesAtStart;
  const maxPly = plies.length;

  const boardFen = selected ? selected.fenAfter : START_FEN;
  const previewPieces = useMemo(() => piecesFromFen(boardFen), [boardFen]);
  const previewCheck = useMemo(() => kingInCheckSquare(boardFen), [boardFen]);
  const lastMove = selected
    ? {
        from: selected.uci.slice(0, 2) as Square,
        to: selected.uci.slice(2, 4) as Square,
      }
    : null;
  const reviewArrows = useMemo(() => arrowsForPly(selected), [selected]);

  const goToPly = useCallback(
    (ply: number | null, animate: boolean) => {
      onSelectPly(ply);
      if (animate && ply != null) {
        const target = plies.find((p) => p.ply === ply);
        if (target) {
          animCounter.current += 1;
          setReviewAnim(plyToAnimation(target, animCounter.current));
        }
      } else {
        setReviewAnim(null);
      }
    },
    [onSelectPly, plies]
  );

  const stopTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (state.status !== 'done' || !summary || summary.aborted || plies.length === 0) return;
    const key = `${summary.startedAt}-${summary.finishedAt}-${plies.length}`;
    if (autoStartedFor === key) return;
    setAutoStartedFor(key);
    onSelectPly(null);
    setReviewAnim(null);
    setPlaying(true);
  }, [state.status, summary, plies.length, autoStartedFor, onSelectPly]);

  useEffect(() => {
    stopTimer();
    if (!playing || state.status !== 'done' || maxPly === 0) return;
    const current = state.selectedPly ?? 0;
    if (current >= maxPly) {
      setPlaying(false);
      return;
    }
    const delay = SPEED_OPTIONS[speedIdx]?.ms ?? 900;
    timerRef.current = window.setTimeout(() => goToPly(current + 1, true), delay);
    return stopTimer;
  }, [playing, state.selectedPly, state.status, maxPly, speedIdx, goToPly, stopTimer]);

  const handleSelectPly = (ply: number | null) => {
    setPlaying(false);
    goToPly(ply, ply != null);
  };

  const handlePlayPause = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if ((state.selectedPly ?? 0) >= maxPly) {
      onSelectPly(null);
      setReviewAnim(null);
    }
    setPlaying(true);
  };

  const submitPgn = () => {
    const text = pgnText.trim();
    if (!text || !onAnalyzePgn) return;
    onAnalyzePgn(text);
  };

  return (
    <div className="view analysis-view">
      <header className="view-head analysis-head">
        <div>
          <h1>Game analysis</h1>
          <p>
            Paste a PGN or analyse the current game. When the engine finishes, the game replays with
            Brilliant, Best, Book, Mistake, Blunder and other grades.
          </p>
        </div>
        <div className="analysis-controls">
          <label className="analysis-depth">
            <span>Engine depth</span>
            <select
              className="select"
              value={depth}
              onChange={(e) => onDepthChange(Number(e.target.value))}
              disabled={state.status === 'running'}
            >
              {DEPTH_CHOICES.map((d) => (
                <option key={d} value={d}>
                  {d}
                  {d === 12 ? ' (recommended)' : ''}
                </option>
              ))}
            </select>
          </label>
          {state.status === 'running' ? (
            <button type="button" className="btn danger" onClick={onCancel}>
              Cancel analysis
            </button>
          ) : (
            <button type="button" className="btn primary" onClick={onAnalyze}>
              {summary ? 'Analyse current game again' : 'Analyse current game'}
            </button>
          )}
        </div>
      </header>

      {onAnalyzePgn && state.status !== 'running' && (
        <section className="card analysis-pgn-import">
          <h2 className="card-title">Import PGN</h2>
          <p className="gp-muted">
            Paste a full PGN from Chess.com, Lichess, or any standard export.
          </p>
          <textarea
            className="analysis-pgn-textarea"
            rows={6}
            value={pgnText}
            onChange={(e) => setPgnText(e.target.value)}
            placeholder={'[Event "Casual Game"]\n[White "Player"]\n[Black "Opponent"]\n\n1. e4 e5 2. Nf3 ...'}
            spellCheck={false}
          />
          <div className="analysis-pgn-actions">
            <button type="button" className="btn primary" disabled={!pgnText.trim()} onClick={submitPgn}>
              Analyse this PGN
            </button>
            <label className="btn ghost">
              Upload .pgn
              <input
                type="file"
                accept=".pgn,text/plain"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setPgnText(String(reader.result || ''));
                  reader.readAsText(file);
                }}
              />
            </label>
          </div>
        </section>
      )}

      {state.warning && <div className="analysis-warning">{state.warning}</div>}

      {state.status === 'running' && (
        <section className="card analysis-progress" aria-live="polite">
          <div className="analysis-progress-head">
            <strong>
              {total === 0
                ? 'Starting the engine…'
                : `Analysing move ${Math.min(completed + 1, total)} of ${total}`}
            </strong>
            <span className="gp-muted">
              {state.progress?.engineLabel ?? 'Engine'}, depth {state.progress?.depth ?? depth}, {percent}%
            </span>
          </div>
          <div className="progress-track" role="progressbar" aria-valuenow={percent}>
            <div className="progress-fill" style={{ width: `${percent}%` }} />
          </div>
          <p className="gp-muted">When this finishes, review starts automatically with move grades.</p>
        </section>
      )}

      {state.status === 'error' && (
        <section className="card analysis-error" role="alert">
          <strong>Analysis failed</strong>
          <p>{state.error}</p>
          <button type="button" className="btn" onClick={onAnalyze}>
            Try current game
          </button>
        </section>
      )}

      {state.status === 'idle' && !summary && (
        <section className="card analysis-intro">
          <h2 className="card-title">What you get</h2>
          <ul>
            <li>Paste any PGN or analyse the game you just played.</li>
            <li>Every move is graded: Brilliant, Great, Best, Excellent, Good, Book, Inaccuracy, Mistake, Blunder…</li>
            <li>After analysis, the game replays on the board with icons and arrows.</li>
          </ul>
        </section>
      )}

      {summary && (
        <>
          <section className="card analysis-summary">
            <div className="analysis-players">
              <div>
                <span className="analysis-player-name">{summary.players.white}</span>
                <span className="gp-muted">White</span>
                <RatingTierIcon rating={state.ratings.white} size={20} showLabel />
              </div>
              <div className="analysis-result">
                {summary.result ?? 'Unfinished'}
                {summary.aborted ? ' (partial)' : ''}
              </div>
              <div className="analysis-player-right">
                <span className="analysis-player-name">{summary.players.black}</span>
                <span className="gp-muted">Black</span>
                <RatingTierIcon rating={state.ratings.black} size={20} showLabel />
              </div>
            </div>
            <div className="analysis-accuracy">
              <div className="accuracy-cell">
                <span className="accuracy-value">
                  {summary.accuracy.white == null ? '–' : `${summary.accuracy.white.toFixed(1)}%`}
                </span>
                <span className="gp-muted">White accuracy</span>
              </div>
              <div className="accuracy-cell">
                <span className="accuracy-value">
                  {summary.accuracy.black == null ? '–' : `${summary.accuracy.black.toFixed(1)}%`}
                </span>
                <span className="gp-muted">Black accuracy</span>
              </div>
              <div className="accuracy-cell">
                <span className="accuracy-value">{summary.totalMoves}</span>
                <span className="gp-muted">
                  moves, depth {summary.depth}, {summary.engineLabel}
                </span>
              </div>
            </div>
            <div className="analysis-counts">
              {(
                [
                  'brilliant',
                  'great',
                  'best',
                  'excellent',
                  'good',
                  'book',
                  'inaccuracy',
                  'mistake',
                  'blunder',
                  'miss',
                  'forced',
                ] as MoveClassification[]
              )
                .filter((c) => (summary.counts[c] ?? 0) > 0)
                .map((classification) => (
                  <span className="count-chip" key={classification}>
                    <MoveGlyph classification={classification} size={16} overrides={overrides} />
                    <span className="count-number">{summary.counts[classification]}</span>
                    <span className="count-label">{CLASSIFICATION_LABEL[classification]}</span>
                  </span>
                ))}
            </div>
          </section>

          <section className="card analysis-replay">
            <div className="analysis-replay-layout">
              <div className="analysis-board-wrap">
                <ChessBoard
                  pieces={previewPieces}
                  orientation="w"
                  selected={null}
                  legalTargets={[] as Square[]}
                  lastMove={lastMove}
                  checkSquare={previewCheck}
                  premove={null}
                  arrows={reviewArrows}
                  highlights={[]}
                  showCoordinates={showCoordinates}
                  showLegalMoves={false}
                  interactive={false}
                  onSelectSquare={() => undefined}
                  onMove={() => undefined}
                  onArrow={() => undefined}
                  onHighlight={() => undefined}
                  onClearAnnotations={() => undefined}
                  themeClass={boardThemeClass}
                  pieceSet={pieceTheme}
                  animateMoves
                  animation={reviewAnim}
                />
              </div>
              <div className="analysis-replay-side">
                {selected && (
                  <p className="analysis-board-note" role="status">
                    Showing the review board, not the live game. Use “Back to the game” to return.
                  </p>
                )}
                <div className="analysis-detail-badge">
                  {selected ? (
                    <>
                      <MoveGlyph classification={selected.classification} size={20} overrides={overrides} />
                      <div>
                        <strong>
                          {selected.moveNumber}
                          {selected.side === 'w' ? '.' : '…'} {selected.san}
                        </strong>
                        <span className="gp-muted meta-gap">{CLASSIFICATION_LABEL[selected.classification]}</span>
                        <p className="analysis-reason">{selected.reason}</p>
                      </div>
                    </>
                  ) : (
                    <p className="gp-muted">Starting position — replay runs automatically.</p>
                  )}
                </div>
                {selected && (
                  <dl className="analysis-facts">
                    <div>
                      <dt>Eval before</dt>
                      <dd>{formatEvaluation(selected.evalBeforeCpWhite)}</dd>
                    </div>
                    <div>
                      <dt>Eval after</dt>
                      <dd>{formatEvaluation(selected.evalCpWhite)}</dd>
                    </div>
                    <div>
                      <dt>Loss</dt>
                      <dd>
                        {selected.lossCp > 0 ? `−${(selected.lossCp / 100).toFixed(2)}` : '0.00'}
                      </dd>
                    </div>
                  </dl>
                )}
                {selected &&
                  (SUGGEST_FOR.includes(selected.classification) || selected.critical) &&
                  selected.bestMove && (
                    <p className="analysis-best">
                      Engine preferred <strong>{selected.bestMove.san}</strong>
                      <span className="gp-muted meta-gap">Green marks the move played, blue the best move found.</span>
                    </p>
                  )}
                <div className="replay-controls" role="group" aria-label="Replay">
                  <button type="button" className="btn replay-btn" onClick={() => { setPlaying(false); goToPly(null, false); }}>|&lt;</button>
                  <button type="button" className="btn replay-btn" onClick={() => { setPlaying(false); const cur = state.selectedPly ?? 0; if (cur <= 1) goToPly(null, false); else goToPly(cur - 1, true); }}>&lt;</button>
                  <button type="button" className="btn primary replay-btn" onClick={handlePlayPause}>{playing ? 'Pause' : 'Play'}</button>
                  <button type="button" className="btn replay-btn" onClick={() => { setPlaying(false); const cur = state.selectedPly ?? 0; if (cur < maxPly) goToPly(cur + 1, true); }}>&gt;</button>
                  <button type="button" className="btn replay-btn" onClick={() => { setPlaying(false); if (maxPly) goToPly(maxPly, false); }}>&gt;|</button>
                  <select className="select replay-speed" value={speedIdx} onChange={(e) => setSpeedIdx(Number(e.target.value))}>
                    {SPEED_OPTIONS.map((s, i) => (
                      <option key={s.label} value={i}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="replay-scrubber">
                  <input type="range" min={0} max={maxPly} value={state.selectedPly ?? 0} onChange={(e) => { setPlaying(false); const v = Number(e.target.value); if (v <= 0) goToPly(null, false); else goToPly(v, true); }} />
                  <span className="gp-muted">Move {state.selectedPly ?? 0} / {maxPly}</span>
                </div>
                {(state.selectedPly ?? 0) >= maxPly && maxPly > 0 && (
                  <button type="button" className="btn" onClick={() => { onSelectPly(null); setReviewAnim(null); setPlaying(true); }}>Replay again</button>
                )}
              </div>
            </div>
          </section>

          <section className="card analysis-graph-card">
            <EvalGraph plies={plies} selectedPly={state.selectedPly} onSelectPly={handleSelectPly} />
          </section>

          <section className="card analysis-moves">
            <h2 className="card-title">Move by move</h2>
            <ol className="analysis-move-list">
              {plies.map((ply: AnalyzedPly) => (
                <li key={ply.ply}>
                  <button type="button" className={`analysis-move-row${state.selectedPly === ply.ply ? ' is-selected' : ''}`} onClick={() => handleSelectPly(ply.ply)}>
                    <span className="analysis-move-san">
                      <span className="move-number">{ply.moveNumber}{ply.side === 'w' ? '.' : '…'}</span>
                      {ply.san}
                    </span>
                    <span className="analysis-move-grade">
                      <MoveGlyph classification={ply.classification} size={16} overrides={overrides} />
                      <span className="grade-label">{CLASSIFICATION_LABEL[ply.classification]}</span>
                    </span>
                    <span className="analysis-move-eval">{formatEvaluation(ply.evalBeforeCpWhite)} → {formatEvaluation(ply.evalCpWhite)}</span>
                    <span className="analysis-move-loss">{ply.lossCp > 0 ? `-${(ply.lossCp / 100).toFixed(2)}` : '0.00'}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}

      {stale && (
        <div className="analysis-stale" role="status">
          Live game has more moves than this analysis snapshot. Analyse again to include them.
        </div>
      )}

      {summary && (
        <footer className="analysis-foot">
          <span className="gp-muted">{CLASSIFICATION_ICONS.brilliant.label} grades are AIChess engine estimates.</span>
          <button type="button" className="btn" onClick={onReturnToGame}>Back to the game</button>
        </footer>
      )}
    </div>
  );
}
