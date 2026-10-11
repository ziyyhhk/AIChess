import React, { useEffect, useMemo, useState } from 'react';
import type { Square } from 'chess.js';
import { ChessBoard } from './ChessBoard';
import { MoveGlyph } from './analysis/MoveGlyph';
import { EvalGraph } from './analysis/EvalGraph';
import { piecesFromFen, kingInCheckSquare } from '../chess/pieces';
import { formatEvaluation } from '../analysis/analyzeGame';
import { CLASSIFICATION_LABEL, type MoveClassification } from '../analysis/classification';
import {
  CLASSIFICATION_ICONS,
  loadIconOverrides,
  type IconManifest,
} from '../analysis/iconAssets';
import type { AnalysisRunState } from '../analysis/runState';
import type { PieceSetId } from '../chess/pieceAssets';

const DEPTH_CHOICES = [8, 10, 12, 14, 16, 18];

/** Classifications where the engine's alternative is worth showing. */
const SUGGEST_FOR: MoveClassification[] = ['inaccuracy', 'mistake', 'blunder', 'miss'];

export interface AnalysisViewProps {
  state: AnalysisRunState;
  livePlyCount: number;
  depth: number;
  onDepthChange: (depth: number) => void;
  onAnalyze: () => void;
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
  onCancel,
  onSelectPly,
  onReturnToGame,
  pieceTheme,
  boardThemeClass,
  showCoordinates,
  showLegalMoves,
}: AnalysisViewProps) {
  const [overrides, setOverrides] = useState<IconManifest>({});

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
  const selected = state.selectedPly != null ? plies.find((p) => p.ply === state.selectedPly) ?? null : null;
  const total = state.progress?.total ?? 0;
  const completed = state.progress?.completed ?? 0;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const stale = summary != null && livePlyCount !== state.livePliesAtStart;

  const previewPieces = useMemo(
    () => (selected ? piecesFromFen(selected.fenAfter) : []),
    [selected]
  );
  const previewCheck = useMemo(
    () => (selected ? kingInCheckSquare(selected.fenAfter) : null),
    [selected]
  );

  return (
    <div className="view analysis-view">
      <header className="view-head analysis-head">
        <div>
          <h1>Game analysis</h1>
          <p>
            Every move of the current game is rebuilt and searched by the engine in this browser
            tab. Nothing is uploaded anywhere.
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
              {summary ? 'Analyse again' : 'Analyse game'}
            </button>
          )}
        </div>
      </header>

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
              {state.progress?.engineLabel ?? 'Engine'} · depth {state.progress?.depth ?? depth} ·{' '}
              {percent}% of moves done
            </span>
          </div>
          <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <div className="progress-fill" style={{ width: `${percent}%` }} />
          </div>
          <p className="gp-muted">
            Deeper searches take longer. You can cancel at any time — results already found are kept.
          </p>
        </section>
      )}

      {state.status === 'error' && (
        <section className="card analysis-error" role="alert">
          <strong>Analysis failed</strong>
          <p>{state.error}</p>
          <button type="button" className="btn" onClick={onAnalyze}>
            Try again
          </button>
        </section>
      )}

      {state.status === 'idle' && !summary && (
        <section className="card analysis-intro">
          <h2 className="card-title">What this does</h2>
          <ul>
            <li>Reconstructs every position from the moves actually played in your game.</li>
            <li>Searches each position with the engine and reports the evaluation and best line.</li>
            <li>Grades each move from the real evaluation loss — never from a guess.</li>
            <li>Runs in a separate engine worker, so your live game is untouched.</li>
          </ul>
          <p className="gp-muted">
            Book moves come from a small built-in opening list; everything else is graded by the engine.
            The classification thresholds are AIChess&apos;s own heuristics, not Chess.com&apos;s.
          </p>
        </section>
      )}

      {summary && (
        <>
          <section className="card analysis-summary">
            <div className="analysis-players">
              <div>
                <span className="analysis-player-name">{summary.players.white}</span>
                <span className="gp-muted">White</span>
              </div>
              <div className="analysis-result">
                {summary.result ?? 'Game not finished'}
                {summary.aborted ? ' · partial' : ''}
              </div>
              <div className="analysis-player-right">
                <span className="analysis-player-name">{summary.players.black}</span>
                <span className="gp-muted">Black</span>
              </div>
            </div>

            <div className="analysis-accuracy">
              <div className="accuracy-cell">
                <span className="accuracy-value">
                  {summary.accuracy.white == null ? '–' : `${summary.accuracy.white.toFixed(1)}%`}
                </span>
                <span className="gp-muted">White accuracy (AIChess estimate)</span>
              </div>
              <div className="accuracy-cell">
                <span className="accuracy-value">
                  {summary.accuracy.black == null ? '–' : `${summary.accuracy.black.toFixed(1)}%`}
                </span>
                <span className="gp-muted">Black accuracy (AIChess estimate)</span>
              </div>
              <div className="accuracy-cell">
                <span className="accuracy-value">{summary.totalMoves}</span>
                <span className="gp-muted">
                  moves analysed · depth {summary.depth} · {summary.engineLabel}
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
            {summary.criticalCount > 0 && (
              <p className="gp-muted">
                {summary.criticalCount} critical position{summary.criticalCount === 1 ? '' : 's'} where one
                move was clearly stronger than the rest.
              </p>
            )}
          </section>

          <section className="card analysis-graph-card">
            <EvalGraph plies={plies} selectedPly={state.selectedPly} onSelectPly={onSelectPly} />
            <p className="gp-muted">
              The line shows the engine evaluation after each move, from White&apos;s point of view.
              Coloured dots mark the moves that shaped the game.
            </p>
          </section>
        </>
      )}

      {summary && (
        <div className="analysis-body">
          <section className="card analysis-moves">
            <h2 className="card-title">Move by move</h2>
            <div className="analysis-move-header">
              <span>Move</span>
              <span>Grade</span>
              <span>Evaluation</span>
              <span>Loss</span>
            </div>
            <ol className="analysis-move-list">
              {plies.map((ply) => (
                <li key={ply.ply}>
                  <button
                    type="button"
                    className={`analysis-move-row${state.selectedPly === ply.ply ? ' is-selected' : ''}`}
                    onClick={() => onSelectPly(ply.ply)}
                  >
                    <span className="analysis-move-san">
                      <span className="move-number">
                        {ply.moveNumber}
                        {ply.side === 'w' ? '.' : '…'}
                      </span>
                      {ply.san}
                    </span>
                    <span className="analysis-move-grade">
                      <MoveGlyph classification={ply.classification} size={16} overrides={overrides} />
                      <span className="grade-label">{CLASSIFICATION_LABEL[ply.classification]}</span>
                      {ply.critical && <span className="critical-tag">critical</span>}
                    </span>
                    <span className="analysis-move-eval">
                      {formatEvaluation(ply.evalBeforeCpWhite)} → {formatEvaluation(ply.evalCpWhite)}
                    </span>
                    <span className="analysis-move-loss">
                      {ply.lossCp > 0 ? `-${(ply.lossCp / 100).toFixed(2)}` : '0.00'}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            {state.status === 'running' && (
              <p className="gp-muted">Analysis is still running — the list will grow as moves finish.</p>
            )}
          </section>

          <section className="card analysis-detail">
            <h2 className="card-title">
              {selected
                ? `Move ${selected.moveNumber}${selected.side === 'w' ? '.' : '…'} ${selected.san}`
                : 'Position review'}
            </h2>
            {selected ? (
              <>
                <div className="analysis-detail-badge">
                  <MoveGlyph classification={selected.classification} size={18} overrides={overrides} />
                  <span>{CLASSIFICATION_LABEL[selected.classification]}</span>
                  <span className="gp-muted">{selected.reason}</span>
                </div>
                <div className="analysis-board-wrap">
                  <ChessBoard
                    pieces={previewPieces}
                    orientation={selected.side}
                    selected={null}
                    legalTargets={[] as Square[]}
                    lastMove={{ from: selected.uci.slice(0, 2) as Square, to: selected.uci.slice(2, 4) as Square }}
                    checkSquare={previewCheck}
                    premove={null}
                    arrows={[]}
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
                    animateMoves={false}
                    animation={null}
                  />
                  <p className="analysis-board-note">
                    Analysed position after {selected.san} — this is a review board, not your live game.
                  </p>
                </div>
                <dl className="analysis-facts">
                  <div>
                    <dt>Evaluation before</dt>
                    <dd>{formatEvaluation(selected.evalBeforeCpWhite)}</dd>
                  </div>
                  <div>
                    <dt>Evaluation after</dt>
                    <dd>{formatEvaluation(selected.evalCpWhite)}</dd>
                  </div>
                  <div>
                    <dt>Centipawn loss</dt>
                    <dd>{selected.lossCp}</dd>
                  </div>
                  {selected.mateFor && (
                    <div>
                      <dt>Mate</dt>
                      <dd>
                        {selected.mateFor === 'w' ? 'White' : 'Black'}
                        {selected.mateIn ? ` in ${selected.mateIn}` : ''}
                      </dd>
                    </div>
                  )}
                </dl>
                {(SUGGEST_FOR.includes(selected.classification) || selected.critical) && selected.bestMove && (
                  <p className="analysis-best">
                    Engine preferred <strong>{selected.bestMove.san}</strong>
                    {selected.bestLineSan.length > 1 && (
                      <span className="gp-muted"> (line: {selected.bestLineSan.slice(0, 5).join(' ')})</span>
                    )}
                  </p>
                )}
                {showLegalMoves && (
                  <p className="gp-muted">
                    Legal-move dots are hidden on review boards so the played move stays readable.
                  </p>
                )}
                <button type="button" className="btn" onClick={onReturnToGame}>
                  Return to the live game
                </button>
              </>
            ) : (
              <p className="gp-muted">
                Pick a move from the list to see the position, the engine&apos;s evaluation and, when the
                move lost ground, the continuation it preferred.
              </p>
            )}
          </section>
        </div>
      )}

      {stale && (
        <div className="analysis-stale" role="status">
          This analysis is from a snapshot of the game taken before the latest moves. Analyse again to
          include them.
        </div>
      )}

      {summary && (
        <footer className="analysis-foot">
          <span className="gp-muted">
            {CLASSIFICATION_ICONS.brilliant.label} and friends are AIChess&apos;s own engine-based
            heuristics.
          </span>
          <button type="button" className="btn" onClick={onReturnToGame}>
            Back to the game
          </button>
        </footer>
      )}
    </div>
  );
}
