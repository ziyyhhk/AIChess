import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChessBoard } from './components/ChessBoard';
import { AppSidebar } from './components/AppSidebar';
import { GamePanel } from './components/GamePanel';
import { AIModelSelector } from './components/AIModelSelector';
import { SettingsPanel } from './components/SettingsPanel';
import { PromotionDialog } from './components/PromotionDialog';
import { GameResultDialog } from './components/GameResultDialog';
import { AnalysisView } from './components/AnalysisView';
import { HistoryView } from './components/HistoryView';
import { PuzzleView } from './components/PuzzleView';
import { GameController } from './chess/gameController';
import { PremoveManager } from './chess/premoveManager';
import { AnnotationManager } from './chess/annotationManager';
import { exportPgn, pgnFilename, resultToPgnToken } from './chess/pgn';
import { copyText, downloadText } from './chess/pgnExport';
import { moveFacts, moveKey, moveSoundEvent, type MoveActor } from './chess/moveEvents';
import { resolveDropIntent, resolveSquareClick } from './chess/clickIntent';
import { piecesFromBoard } from './chess/pieces';
import { aiManager } from './ai/aiManager';
import { soundManager } from './audio/soundManager';
import { planResultSound } from './audio/soundCatalog';
import { getModelById } from './ai/modelCatalog';
import { DEFAULT_SETTINGS, type AppSettings } from './ai/types';
import { thinkSettingsFromLegacy } from './ai/thinkTime';
import { analyzeGame, buildAnalysisPlies } from './analysis/analyzeGame';
import { analyzePgnString } from './analysis/hintAndPgn';
import { createEvaluator, type Evaluator } from './analysis/evaluator';
import { INITIAL_ANALYSIS_STATE, type AnalysisRunState } from './analysis/runState';
import {
  clearArchive,
  deleteArchivedGame,
  loadArchive,
  saveArchivedGame,
  shouldArchive,
  type ArchivedGame,
} from './history/archive';
import type { Square, Move } from 'chess.js';
import type { SquarePoint } from './components/board/flights';
import './styles/global.css';
import './styles/theme.css';
import './styles/board.css';

type View = 'play' | 'opponents' | 'history' | 'analysis' | 'puzzles' | 'settings' | 'help';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem('aichess-settings');
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppSettings> & { minThinkMs?: number };
      const merged = { ...DEFAULT_SETTINGS, ...parsed } as AppSettings;
      if (!parsed.thinkMode) {
        const legacy = thinkSettingsFromLegacy(parsed.minThinkMs);
        merged.thinkMode = legacy.mode;
        merged.minThinkMs = legacy.customMs;
      }
      return merged;
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS };
}

export default function App() {
  const [view, setView] = useState<View>('play');
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [orientation, setOrientation] = useState<'w' | 'b'>('w');
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');
  const [selected, setSelected] = useState<Square | null>(null);
  const [thinking, setThinking] = useState(false);
  const [status, setStatus] = useState('Your turn. Stockfish needs no API key.');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [animation, setAnimation] = useState<import('./components/board/flights').FlightRequest | null>(null);
  const [tick, setTick] = useState(0);
  const [analysis, setAnalysis] = useState<AnalysisRunState>(INITIAL_ANALYSIS_STATE);
  const [archive, setArchive] = useState<ArchivedGame[]>(() => loadArchive());

  const gameRef = useRef(new GameController());
  const premoveRef = useRef(new PremoveManager());
  const annotRef = useRef(new AnnotationManager());
  const requestingRef = useRef(false);
  const gameStartedAt = useRef(new Date());
  const premoveAfterRef = useRef<string | null>(null);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const evaluatorRef = useRef<Evaluator | null>(null);
  const animationIdRef = useRef(0);
  const lastAnimationIdRef = useRef<string | null>(null);
  const archivedGameRef = useRef(false);

  const refresh = () => setTick((t) => t + 1);
  const game = gameRef.current;
  const model = aiManager.getModelInfo() || getModelById('stockfish');

  useEffect(() => {
    const unlock = () => {
      soundManager.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    soundManager.preload();
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    soundManager.setEnabled(settings.enableSounds !== false);
    soundManager.setPack(settings.soundPack === 'chesscom' ? 'chesscom' : 'builtin');
  }, [settings.enableSounds, settings.soundPack]);

  useEffect(() => {
    try {
      localStorage.setItem('aichess-settings', JSON.stringify(settings));
    } catch {
      /* ignore */
    }
    premoveRef.current.setEnabled(settings.enablePremoves);
  }, [settings]);

  useEffect(() => {
    aiManager.setDifficulty(settings.difficulty as AppSettings['difficulty'], {
      skillLevel: settings.customSkillLevel,
      depth: settings.customDepth,
      movetimeMs: settings.customMovetimeMs,
    });
  }, [settings.difficulty, settings.customSkillLevel, settings.customDepth, settings.customMovetimeMs]);

  useEffect(() => {
    aiManager.setThinkTime({ mode: settings.thinkMode, customMs: settings.minThinkMs });
  }, [settings.thinkMode, settings.minThinkMs]);

  useEffect(() => {
    aiManager.setModel(settings.defaultOpponent || 'stockfish');
  }, [settings.defaultOpponent]);

  const pieces = useMemo(() => piecesFromBoard(game.getBoard()), [tick]);
  const legalTargets = useMemo(() => {
    if (!selected) return [];
    return game.getLegalMoves(selected).map((m) => m.to);
  }, [selected, tick]);
  const isPlayerTurn = game.getTurn() === playerColor && !game.isGameOver();
  const moveHistory = game.getHistorySan();

  const boardThemeClass =
    settings.boardTheme === 'brown'
      ? 'theme-brown'
      : settings.boardTheme === 'blue'
        ? 'theme-blue'
        : settings.boardTheme === 'purple'
          ? 'theme-purple'
          : 'theme-green';

  const archiveGame = useCallback(
    (resultTokenOverride?: string) => {
      const plies = game.getHistoryVerbose().length;
      if (!shouldArchive(plies) || archivedGameRef.current) return;
      archivedGameRef.current = true;
      const whiteName = playerColor === 'w' ? 'You' : model?.name || 'AI';
      const blackName = playerColor === 'b' ? 'You' : model?.name || 'AI';
      const token =
        resultTokenOverride ??
        (game.isGameOver()
          ? resultToPgnToken(game.getResult(), true)
          : result === 'white'
            ? '1-0'
            : result === 'black'
              ? '0-1'
              : result === 'draw' || result === 'stalemate'
                ? '1/2-1/2'
                : '*');
      const pgn = exportPgn(game, {
        white: whiteName,
        black: blackName,
        result: token,
        event: 'AIChess Casual Game',
      });
      setArchive(
        saveArchivedGame({
          id: `${gameStartedAt.current.getTime()}-${plies}`,
          startedAt: gameStartedAt.current.toISOString(),
          finishedAt: new Date().toISOString(),
          white: whiteName,
          black: blackName,
          result: token,
          plies,
          playerColor,
          pgn,
          unfinished: token === '*',
        })
      );
    },
    [game, playerColor, model, result]
  );

  const finishIfOver = useCallback(() => {
    if (!game.isGameOver()) return false;
    const r = game.getResult();
    setResult(r);
    setShowResult(true);
    setStatus(r === 'white' ? 'White wins' : r === 'black' ? 'Black wins' : 'Draw');
    setThinking(false);
    requestingRef.current = false;
    premoveRef.current.clear();
    aiManager.cancel();
    archiveGame();
    return true;
  }, [archiveGame]);

  const commitMove = useCallback(
    (
      from: Square,
      to: Square,
      promotionPiece: string | undefined,
      actor: MoveActor,
      dropPoint?: SquarePoint
    ): Move | null => {
      const fenBefore = game.getFen();
      const move = game.makeMove(from, to, promotionPiece);
      if (!move) return null;
      const facts = moveFacts(move);
      const isCheckmate = game.isCheckmate();
      const isDraw = game.isDraw() && !isCheckmate;
      soundManager.playMove(
        moveSoundEvent({
          actor,
          move,
          isCheck: game.isCheck(),
          isCheckmate,
          isDraw,
          playerWon: isCheckmate ? game.getTurn() !== playerColor : undefined,
        }),
        moveKey(fenBefore, move)
      );
      const id = `${moveKey(fenBefore, move)}#${++animationIdRef.current}`;
      lastAnimationIdRef.current = id;
      setAnimation({
        id,
        from: move.from,
        to: move.to,
        color: move.color,
        type: move.piece,
        isCastle: facts.isCastle,
        dropPoint,
      });
      setSelected(null);
      annotRef.current.clear();
      refresh();
      return move;
    },
    [playerColor]
  );

  const playQueuedPremove = useCallback(() => {
    premoveAfterRef.current = null;
    const queued = premoveRef.current.get();
    if (!queued) return;
    if (game.isGameOver() || game.getTurn() !== playerColor) {
      premoveRef.current.clear();
      refresh();
      return;
    }
    const stillLegal = premoveRef.current.consumeIfLegal(game.getLegalUci());
    if (!stillLegal) {
      refresh();
      return;
    }
    commitMove(stillLegal.from, stillLegal.to, stillLegal.promotion, 'player');
    finishIfOver();
  }, [playerColor, commitMove, finishIfOver]);

  const handleAnimationSettled = useCallback(
    (moveId: string) => {
      if (premoveAfterRef.current !== moveId) return;
      premoveAfterRef.current = null;
      playQueuedPremove();
    },
    [playQueuedPremove]
  );

  const requestAIMove = useCallback(async () => {
    if (requestingRef.current || game.isGameOver()) return;
    if (game.getTurn() === playerColor) return;
    requestingRef.current = true;
    setThinking(true);
    setError(null);
    const info = aiManager.getModelInfo();
    setStatus(`${info?.name || 'AI'} is thinking…`);
    const positionFen = game.getFen();
    try {
      const res = await aiManager.requestMove(
        {
          fen: positionFen,
          legalMoves: game.getLegalUci(),
          history: game.getHistorySan(),
          sideToMove: game.getTurn(),
          timeoutMs: settings.aiTimeoutMs,
        },
        apiKeys
      );
      if (game.getFen() !== positionFen || game.isGameOver()) return;
      const from = res.move.slice(0, 2) as Square;
      const to = res.move.slice(2, 4) as Square;
      const promotionPiece = res.move.length > 4 ? res.move[4] : undefined;
      const move = commitMove(from, to, promotionPiece, 'opponent');
      if (!move) {
        setError(`The AI proposed a move that is not legal here (${res.move}).`);
        setStatus('Your turn. AI failed.');
        return;
      }
      if (!finishIfOver()) {
        setStatus('Your turn');
        if (settings.enablePremoves && premoveRef.current.get()) {
          premoveAfterRef.current = lastAnimationIdRef.current;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI request failed';
      if (!/stale|abort/i.test(msg)) {
        setError(msg);
        setStatus('Your turn. AI failed.');
        soundManager.play('notify');
      }
    } finally {
      setThinking(false);
      requestingRef.current = false;
    }
  }, [apiKeys, playerColor, settings, commitMove, finishIfOver]);

  useEffect(() => {
    if (!game.isGameOver() && game.getTurn() !== playerColor && !requestingRef.current) {
      const timer = setTimeout(() => void requestAIMove(), 120);
      return () => clearTimeout(timer);
    }
  }, [tick, playerColor, requestAIMove]);

  const targetsFor = (square: Square) => game.getLegalMoves(square).map((m) => m.to);
  const promotionTargetsFor = (square: Square) =>
    game.getLegalMoves(square).filter((m) => m.promotion).map((m) => m.to);

  const onSelectSquare = (sq: Square) => {
    const piece = game.getPiece(sq);
    const intent = resolveSquareClick({
      selected,
      clicked: sq,
      clickedPiece: piece ? { color: piece.color } : null,
      playerColor,
      isPlayerTurn,
      premovesEnabled: settings.enablePremoves,
      gameOver: game.isGameOver(),
      legalTargets: selected ? targetsFor(selected) : [],
      promotionTargets: selected ? promotionTargetsFor(selected) : [],
    });
    switch (intent.kind) {
      case 'select':
        setSelected(intent.square);
        return;
      case 'deselect':
        setSelected(null);
        return;
      case 'premove':
        premoveRef.current.set(intent.from, intent.to);
        soundManager.play('premove');
        setSelected(null);
        refresh();
        return;
      case 'promote':
        setPromotion({ from: intent.from, to: intent.to });
        return;
      case 'move': {
        const move = commitMove(intent.from, intent.to, undefined, 'player');
        if (move) finishIfOver();
        else soundManager.play('illegal');
        return;
      }
      case 'illegal':
        soundManager.play('illegal');
        return;
      default:
        return;
    }
  };

  const onMove = (from: Square, to: Square, dropPoint?: SquarePoint) => {
    const pieceAtFrom = game.getPiece(from);
    const pieceAtTo = game.getPiece(to);
    const intent = resolveDropIntent({
      from,
      to,
      pieceAtFrom: pieceAtFrom ? { color: pieceAtFrom.color } : null,
      pieceAtTo: pieceAtTo ? { color: pieceAtTo.color } : null,
      playerColor,
      isPlayerTurn,
      premovesEnabled: settings.enablePremoves,
      gameOver: game.isGameOver(),
      legalTargets: targetsFor(from),
      promotionTargets: promotionTargetsFor(from),
    });
    switch (intent.kind) {
      case 'select':
        setSelected(intent.square);
        return;
      case 'premove':
        premoveRef.current.set(intent.from, intent.to);
        soundManager.play('premove');
        setSelected(null);
        refresh();
        return;
      case 'promote':
        setPromotion({ from: intent.from, to: intent.to });
        return;
      case 'move': {
        const move = commitMove(intent.from, intent.to, undefined, 'player', dropPoint);
        if (move) finishIfOver();
        else soundManager.play('illegal');
        return;
      }
      case 'illegal':
        soundManager.play('illegal');
        return;
      default:
        return;
    }
  };

  const onPromotion = (piece: 'q' | 'r' | 'b' | 'n') => {
    if (!promotion) return;
    const move = commitMove(promotion.from, promotion.to, piece, 'player');
    if (move) finishIfOver();
    setPromotion(null);
  };

  const newGame = useCallback(() => {
    archiveGame();
    archivedGameRef.current = false;
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    evaluatorRef.current?.dispose();
    evaluatorRef.current = null;
    setAnalysis(INITIAL_ANALYSIS_STATE);
    premoveAfterRef.current = null;
    premoveRef.current.clear();
    aiManager.cancel();
    requestingRef.current = false;
    game.reset();
    annotRef.current.clear();
    gameStartedAt.current = new Date();
    setSelected(null);
    setResult(null);
    setShowResult(false);
    setError(null);
    setThinking(false);
    setAnimation(null);
    const color: 'w' | 'b' =
      settings.defaultColor === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : settings.defaultColor;
    setPlayerColor(color);
    setOrientation(color);
    setStatus(color === 'w' ? 'Your turn' : 'AI is thinking…');
    soundManager.play('gameStart');
    refresh();
  }, [settings.defaultColor, archiveGame]);

  const undo = () => {
    if (thinking) return;
    premoveAfterRef.current = null;
    premoveRef.current.clear();
    aiManager.cancel();
    game.undo();
    game.undo();
    setSelected(null);
    setError(null);
    setResult(null);
    setShowResult(false);
    setAnimation(null);
    setStatus('Your turn');
    refresh();
  };

  const resign = () => {
    if (game.isGameOver()) return;
    premoveAfterRef.current = null;
    premoveRef.current.clear();
    aiManager.cancel();
    const resignResult = playerColor === 'w' ? 'black' : 'white';
    archiveGame(resignResult === 'white' ? '1-0' : '0-1');
    setResult(resignResult);
    setShowResult(true);
    setStatus(resignResult === 'white' ? 'White wins' : 'Black wins');
    setThinking(false);
    requestingRef.current = false;
    soundManager.play(planResultSound(resignResult, playerColor));
    refresh();
  };

  const startAnalysisFromPgn = useCallback(
    async (pgn: string, players?: { white: string; black: string }) => {
      analysisAbortRef.current?.abort();
      evaluatorRef.current?.dispose();
      const controller = new AbortController();
      analysisAbortRef.current = controller;
      setView('analysis');
      setAnalysis({
        ...INITIAL_ANALYSIS_STATE,
        status: 'running',
        players: players || { white: 'White', black: 'Black' },
        progress: {
          phase: 'starting',
          completed: 0,
          total: 0,
          moveNumber: 1,
          side: 'w',
          san: null,
          depth: settings.analysisDepth,
          engineLabel: 'Loading engine…',
        },
      });
      try {
        const result = await analyzePgnString(
          pgn,
          settings.analysisDepth,
          controller.signal,
          (progress) => setAnalysis((a) => ({ ...a, progress: progress as any })),
          players
        );
        if (controller.signal.aborted) return;
        if (result.error || !result.analysis) {
          setAnalysis((a) => ({
            ...a,
            status: 'error',
            error: result.error || 'Analysis produced no results.',
            players: result.players,
          }));
          return;
        }
        setAnalysis((a) => ({
          ...a,
          status: 'done',
          result: result.analysis!,
          warning: result.warning,
          players: result.players,
          snapshotPlies: result.analysis!.plies.length,
          livePliesAtStart: game.getHistoryVerbose().length,
        }));
      } catch (e) {
        if (!controller.signal.aborted) {
          setAnalysis((a) => ({
            ...a,
            status: 'error',
            error: e instanceof Error ? e.message : 'Analysis failed.',
          }));
        }
      } finally {
        if (analysisAbortRef.current === controller) analysisAbortRef.current = null;
      }
    },
    [settings.analysisDepth, game]
  );

  const startAnalysis = useCallback(async () => {
    const verbose = game.getHistoryVerbose();
    if (verbose.length === 0) {
      setAnalysis((a) => ({
        ...a,
        status: 'error',
        error: 'There are no moves to analyse yet. Play a few moves first.',
      }));
      return;
    }
    const plies = buildAnalysisPlies(verbose);
    const whiteName = playerColor === 'w' ? 'You' : model?.name || 'AI';
    const blackName = playerColor === 'b' ? 'You' : model?.name || 'AI';
    const resultToken =
      resultToPgnToken(game.getResult(), game.isGameOver()) ||
      (result === 'white' ? '1-0' : result === 'black' ? '0-1' : '*');
    analysisAbortRef.current?.abort();
    evaluatorRef.current?.dispose();
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    setAnalysis({
      ...INITIAL_ANALYSIS_STATE,
      status: 'running',
      snapshotPlies: plies.length,
      livePliesAtStart: verbose.length,
      players: { white: whiteName, black: blackName },
      progress: {
        phase: 'starting',
        completed: 0,
        total: plies.length,
        moveNumber: 1,
        side: 'w',
        san: null,
        depth: settings.analysisDepth,
        engineLabel: 'Loading engine…',
      },
    });
    try {
      const { evaluator, warning } = await createEvaluator();
      if (controller.signal.aborted) {
        evaluator.dispose();
        return;
      }
      evaluatorRef.current = evaluator;
      setAnalysis((a) => ({ ...a, warning: warning ?? null }));
      const analysisResult = await analyzeGame({
        plies,
        evaluator,
        depth: settings.analysisDepth,
        startFen: START_FEN,
        signal: controller.signal,
        warning: warning ?? null,
        players: { white: whiteName, black: blackName },
        result: resultToken,
        onProgress: (progress) => setAnalysis((a) => ({ ...a, progress })),
      });
      if (analysisAbortRef.current === controller) {
        setAnalysis((a) => ({
          ...a,
          status: 'done',
          result: analysisResult,
          warning: warning ?? null,
        }));
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'The analysis failed.';
      if (!controller.signal.aborted) {
        setAnalysis((a) => ({ ...a, status: 'error', error: message }));
      }
    } finally {
      if (analysisAbortRef.current === controller) analysisAbortRef.current = null;
    }
  }, [game, playerColor, model, result, settings.analysisDepth]);

  const cancelAnalysis = useCallback(() => {
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    setAnalysis((a) => ({ ...a, status: a.result ? 'done' : 'idle' }));
  }, []);

  const openAnalysis = useCallback(() => {
    setView('analysis');
    void startAnalysis();
  }, [startAnalysis]);

  return (
    <div className="app-shell">
      <AppSidebar active={view} onNavigate={setView} />
      <div className="app-main">
        {view === 'play' && (
          <div className="play-layout">
            <div className="play-board-col">
              <ChessBoard
                pieces={pieces}
                orientation={orientation}
                selected={selected}
                legalTargets={legalTargets}
                lastMove={game.getLastMove()}
                checkSquare={game.getCheckSquare()}
                premove={premoveRef.current.get()}
                arrows={annotRef.current.getArrows()}
                highlights={annotRef.current.getHighlights()}
                showCoordinates={settings.showCoordinates}
                showLegalMoves={settings.showLegalMoves}
                interactive
                onSelectSquare={onSelectSquare}
                onMove={onMove}
                onArrow={(from, to) => {
                  annotRef.current.addArrow(from, to);
                  refresh();
                }}
                onHighlight={(sq) => {
                  annotRef.current.toggleHighlight(sq);
                  refresh();
                }}
                onClearAnnotations={() => {
                  annotRef.current.clear();
                  refresh();
                }}
                themeClass={boardThemeClass}
                pieceSet={settings.pieceTheme}
                animateMoves={settings.enableAnimations}
                animation={animation}
                onAnimationSettled={handleAnimationSettled}
                playerColor={playerColor}
              />
            </div>
            <GamePanel
              model={model}
              thinking={thinking}
              status={status}
              error={error}
              canUndo={moveHistory.length >= 2 && !thinking}
              gameOver={game.isGameOver()}
              onNewGame={newGame}
              onUndo={undo}
              onFlip={() => setOrientation((o) => (o === 'w' ? 'b' : 'w'))}
              onResign={resign}
              onClearArrows={() => {
                annotRef.current.clear();
                refresh();
              }}
              onCopyPgn={async () =>
                copyText(
                  exportPgn(game, {
                    white: playerColor === 'w' ? 'You' : model?.name || 'AI',
                    black: playerColor === 'b' ? 'You' : model?.name || 'AI',
                    result: resultToPgnToken(game.getResult(), game.isGameOver()) || '*',
                    event: 'AIChess Casual Game',
                  })
                )
              }
              getPgnText={() =>
                exportPgn(game, {
                  white: playerColor === 'w' ? 'You' : model?.name || 'AI',
                  black: playerColor === 'b' ? 'You' : model?.name || 'AI',
                  result: resultToPgnToken(game.getResult(), game.isGameOver()) || '*',
                  event: 'AIChess Casual Game',
                })
              }
              onDownloadPgn={() =>
                downloadText(
                  pgnFilename(new Date()),
                  exportPgn(game, {
                    white: playerColor === 'w' ? 'You' : model?.name || 'AI',
                    black: playerColor === 'b' ? 'You' : model?.name || 'AI',
                    result: resultToPgnToken(game.getResult(), game.isGameOver()) || '*',
                    event: 'AIChess Casual Game',
                  })
                )
              }
              moveHistory={moveHistory}
              difficulty={settings.difficulty}
              onDifficultyChange={(d) =>
                setSettings((s) => ({ ...s, difficulty: d as AppSettings['difficulty'] }))
              }
              soundEnabled={settings.enableSounds}
              onToggleSound={() => setSettings((s) => ({ ...s, enableSounds: !s.enableSounds }))}
              volume={0.7}
              onVolumeChange={(v) => soundManager.setVolume(v)}
              playerColor={playerColor}
              isCheck={game.isCheck()}
              onUseStockfish={() => {
                setSettings((s) => ({ ...s, defaultOpponent: 'stockfish' }));
                aiManager.setModel('stockfish');
              }}
              currentModelId={settings.defaultOpponent}
              premovesEnabled={settings.enablePremoves}
              onAnalyze={openAnalysis}
              premove={premoveRef.current.get()}
            />
          </div>
        )}
        {view === 'opponents' && (
          <AIModelSelector
            currentId={settings.defaultOpponent}
            onSelect={(id) => setSettings((s) => ({ ...s, defaultOpponent: id }))}
            apiKeys={apiKeys}
            onApiKeyChange={(provider, key) => setApiKeys((k) => ({ ...k, [provider]: key }))}
            onClearKey={(provider) =>
              setApiKeys((k) => {
                const next = { ...k };
                delete next[provider];
                return next;
              })
            }
          />
        )}
        {view === 'settings' && (
          <SettingsPanel settings={settings} onChange={setSettings} />
        )}
        {view === 'history' && (
          <HistoryView
            games={archive}
            onCopy={(pgn) => copyText(pgn)}
            onDownload={(entry) => downloadText(pgnFilename(new Date(entry.startedAt)), entry.pgn)}
            onDelete={(id) => setArchive(deleteArchivedGame(id))}
            onClear={() => setArchive(clearArchive())}
            onAnalyzeGame={(entry) => {
              void startAnalysisFromPgn(entry.pgn, { white: entry.white, black: entry.black });
            }}
            onImportPgn={(pgn) => {
              void startAnalysisFromPgn(pgn);
            }}
          />
        )}
        {view === 'analysis' && (
          <AnalysisView
            state={analysis}
            livePlyCount={moveHistory.length}
            depth={settings.analysisDepth}
            onDepthChange={(d) => setSettings((s) => ({ ...s, analysisDepth: d }))}
            onAnalyze={() => void startAnalysis()}
            onAnalyzePgn={(pgn) => void startAnalysisFromPgn(pgn)}
            onCancel={cancelAnalysis}
            onSelectPly={(ply) => setAnalysis((a) => ({ ...a, selectedPly: ply }))}
            onReturnToGame={() => setView('play')}
            pieceTheme={settings.pieceTheme}
            boardThemeClass={boardThemeClass}
            showCoordinates={settings.showCoordinates}
            showLegalMoves={settings.showLegalMoves}
          />
        )}
        {view === 'puzzles' && (
          <PuzzleView
            pieceTheme={settings.pieceTheme}
            boardThemeClass={boardThemeClass}
            showCoordinates={settings.showCoordinates}
            enableSounds={settings.enableSounds !== false}
          />
        )}
        {view === 'help' && (
          <div className="placeholder-view help-view">
            <h1>About AIChess</h1>
            <p>
              Play against the built-in Stockfish engine with no key, or against Gemini and OpenRouter
              models with your own API key.
            </p>
            <ul>
              <li>Drag a piece, or click it and then click the destination.</li>
              <li>Move while the opponent thinks to queue a premove.</li>
              <li>Right-click to draw arrows. Right-click a square to highlight it.</li>
              <li>Paste a PGN in Analysis to review with Brilliant / Book / Blunder grades.</li>
              <li>Puzzles are engine-validated tactics with retry and rating.</li>
            </ul>
          </div>
        )}
      </div>
      {promotion && (
        <PromotionDialog
          color={playerColor}
          onSelect={onPromotion}
          onCancel={() => setPromotion(null)}
        />
      )}
      {showResult && result && (
        <GameResultDialog result={result} onNewGame={newGame} onClose={() => setShowResult(false)} />
      )}
    </div>
  );
}
