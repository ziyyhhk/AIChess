import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChessBoard } from './components/ChessBoard';
import { AppSidebar } from './components/AppSidebar';
import { GamePanel } from './components/GamePanel';
import { AIModelSelector } from './components/AIModelSelector';
import { SettingsPanel } from './components/SettingsPanel';
import { PromotionDialog } from './components/PromotionDialog';
import { GameResultDialog } from './components/GameResultDialog';
import { GameController } from './chess/gameController';
import { PremoveManager } from './chess/premoveManager';
import { AnnotationManager } from './chess/annotationManager';
import { exportPgn, pgnFilename, resultToPgnToken } from './chess/pgn';
import { aiManager } from './ai/aiManager';
import { soundManager } from './audio/soundManager';
import { getModelById } from './ai/modelCatalog';
import { DEFAULT_SETTINGS, type AppSettings } from './ai/types';
import type { Square } from 'chess.js';
import './styles/global.css';
import './styles/theme.css';
import './styles/board.css';

type View = 'play' | 'opponents' | 'history' | 'analysis' | 'settings' | 'help';

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem('aichess-settings');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

export default function App() {
  useEffect(() => {
    const unlock = () => {
      soundManager.unlock();
      soundManager.preload();
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  const [view, setView] = useState<View>('play');
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  useEffect(() => {
    aiManager.setDifficulty(settings.difficulty as any, {
      skillLevel: settings.customSkillLevel,
      depth: settings.customDepth,
      movetimeMs: settings.customMovetimeMs,
    });
  }, [settings.difficulty, settings.customSkillLevel, settings.customDepth, settings.customMovetimeMs]);

  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [orientation, setOrientation] = useState<'w' | 'b'>('w');
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');
  const [selected, setSelected] = useState<Square | null>(null);
  const [thinking, setThinking] = useState(false);
  const [status, setStatus] = useState('Your turn — Stockfish needs no API key');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [tick, setTick] = useState(0);

  const gameRef = useRef(new GameController());
  const premoveRef = useRef(new PremoveManager());
  const annotRef = useRef(new AnnotationManager());
  const requestingRef = useRef(false);
  const gameStartedAt = useRef(new Date());

  const refresh = () => setTick((t) => t + 1);
  const game = gameRef.current;
  const model = aiManager.getModelInfo() || getModelById('stockfish');

  useEffect(() => {
    try { localStorage.setItem('aichess-settings', JSON.stringify(settings)); } catch {}
    premoveRef.current.setEnabled(settings.enablePremoves);
    soundManager.setEnabled(settings.enableSounds !== false);
  }, [settings]);

  useEffect(() => { aiManager.setModel(settings.defaultOpponent); }, []);

  const pieces = useMemo(() => {
    const board = game.getBoard();
    const list: { type: string; color: 'w' | 'b'; square: Square }[] = [];
    const files = 'abcdefgh';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p) list.push({ type: p.type, color: p.color, square: `${files[c]}${8 - r}` as Square });
      }
    }
    return list;
  }, [tick]);

  const legalTargets = useMemo(() => {
    if (!selected) return [];
    return game.getLegalMoves(selected).map((m) => m.to);
  }, [selected, tick]);

  const isPlayerTurn = game.getTurn() === playerColor && !game.isGameOver();

  const applyMove = useCallback((from: Square, to: Square, promotion?: string) => {
    const move = game.makeMove(from, to, promotion);
    if (!move) return false as const;
    setSelected(null);
    annotRef.current.clear();
    refresh();
    return move;
  }, []);

  const playMoveSound = useCallback((move: import('chess.js').Move, isPlayer: boolean) => {
    const flags = move.flags || '';
    const isCapture = flags.includes('c') || flags.includes('e');
    const isCastle = flags.includes('k') || flags.includes('q');
    const isPromotion = !!move.promotion || flags.includes('p');
    const isCheckmate = game.isCheckmate();
    const isCheck = game.isCheck();
    const isDraw = game.isDraw() && !isCheckmate;
    let playerWon: boolean | undefined;
    if (isCheckmate) playerWon = game.getTurn() !== playerColor;
    soundManager.playForMove({
      isPlayer, isCapture, isCastle, isPromotion,
      isCheck: isCheck && !isCheckmate, isCheckmate, isDraw, playerWon,
    });
  }, [playerColor]);

  const checkGameOver = useCallback(() => {
    if (game.isGameOver()) {
      const r = game.getResult();
      setResult(r);
      setShowResult(true);
      setStatus(r === 'white' ? 'White wins' : r === 'black' ? 'Black wins' : 'Draw');
      setThinking(false);
      requestingRef.current = false;
      aiManager.cancel();
      return true;
    }
    return false;
  }, []);

  const requestAIMove = useCallback(async () => {
    if (requestingRef.current || game.isGameOver()) return;
    if (game.getTurn() === playerColor) return;
    requestingRef.current = true;
    setThinking(true);
    setError(null);
    setStatus('AI is thinking…');
    try {
      const legal = game.getLegalUci();
      const res = await aiManager.requestMove({
        fen: game.getFen(), legalMoves: legal, history: game.getHistorySan(),
        sideToMove: game.getTurn(), timeoutMs: settings.aiTimeoutMs,
      }, apiKeys);
      if (game.isGameOver()) return;
      const moveObj = game.makeUciMove(res.move);
      if (!moveObj) setError(`AI proposed illegal move: ${res.move}`);
      else {
        playMoveSound(moveObj, false);
        setStatus('Your turn');
        if (settings.enablePremoves) {
          const pm = premoveRef.current.consumeIfLegal(game.getLegalUci());
          if (pm) game.makeMove(pm.from, pm.to, pm.promotion);
        }
      }
      refresh();
      checkGameOver();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI request failed';
      if (!msg.includes('Stale') && !msg.includes('Aborted')) {
        setError(msg);
        setStatus('Your turn — AI failed');
      }
    } finally {
      setThinking(false);
      requestingRef.current = false;
    }
  }, [apiKeys, playerColor, settings, checkGameOver, playMoveSound]);

  useEffect(() => {
    if (!game.isGameOver() && game.getTurn() !== playerColor && !requestingRef.current) {
      const t = setTimeout(() => requestAIMove(), 120);
      return () => clearTimeout(t);
    }
  }, [tick, playerColor, requestAIMove]);

  const onSelectSquare = (sq: Square) => {
    if (game.isGameOver()) return;
    const piece = game.getPiece(sq);

    if (!isPlayerTurn && settings.enablePremoves) {
      if (selected) {
        if (piece && piece.color === playerColor) {
          if (selected === sq) setSelected(null);
          else setSelected(sq);
          return;
        }
        premoveRef.current.set(selected, sq);
        soundManager.play('premove');
        setSelected(null);
        refresh();
        return;
      }
      if (piece && piece.color === playerColor) { setSelected(sq); return; }
      setSelected(null);
      return;
    }

    if (!isPlayerTurn) return;

    if (!selected) {
      if (piece && piece.color === playerColor) setSelected(sq);
      return;
    }

    if (selected === sq) {
      setSelected(null);
      return;
    }

    if (piece && piece.color === playerColor) {
      setSelected(sq);
      return;
    }

    const moves = game.getLegalMoves(selected);
    const match = moves.find((m) => m.to === sq);
    if (match && match.promotion) {
      setPromotion({ from: selected, to: sq });
      return;
    }
    const m = applyMove(selected, sq);
    if (m) {
      playMoveSound(m as any, true);
      checkGameOver();
    } else {
      soundManager.play('illegal');
    }
  };

  const onMove = (from: Square, to: Square) => {
    if (game.isGameOver()) return;
    if (from === to) return;

    if (!isPlayerTurn && settings.enablePremoves) {
      const piece = game.getPiece(from);
      if (piece && piece.color === playerColor) {
        const dest = game.getPiece(to);
        if (dest && dest.color === playerColor) {
          setSelected(to);
          return;
        }
        premoveRef.current.set(from, to);
        soundManager.play('premove');
        setSelected(null);
        refresh();
      }
      return;
    }
    if (!isPlayerTurn) return;

    const destPiece = game.getPiece(to);
    if (destPiece && destPiece.color === playerColor) {
      setSelected(to);
      return;
    }

    const moves = game.getLegalMoves(from);
    const match = moves.find((m) => m.to === to);
    if (match?.promotion) { setPromotion({ from, to }); return; }
    const m = applyMove(from, to);
    if (m) {
      playMoveSound(m as any, true);
      checkGameOver();
    } else {
      soundManager.play('illegal');
    }
  };

  const onPromotion = (p: 'q' | 'r' | 'b' | 'n') => {
    if (!promotion) return;
    const m = applyMove(promotion.from, promotion.to, p);
    if (m) { playMoveSound(m as any, true); checkGameOver(); }
    setPromotion(null);
  };

  const newGame = () => {
    soundManager.play('gameStart');
    aiManager.cancel();
    requestingRef.current = false;
    game.reset();
    premoveRef.current.clear();
    annotRef.current.clear();
    gameStartedAt.current = new Date();
    setSelected(null); setResult(null); setShowResult(false); setError(null); setThinking(false);
    const color: 'w' | 'b' = settings.defaultColor === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : settings.defaultColor;
    setPlayerColor(color); setOrientation(color);
    setStatus(color === 'w' ? 'Your turn' : 'AI is thinking…');
    refresh();
  };

  const undo = () => {
    if (thinking) return;
    aiManager.cancel();
    game.undo(); game.undo();
    premoveRef.current.clear();
    setSelected(null); setError(null); setResult(null); setShowResult(false);
    setStatus('Your turn'); refresh();
  };

  const resign = () => {
    if (game.isGameOver()) return;
    aiManager.cancel();
    setResult(playerColor === 'w' ? 'black' : 'white');
    setShowResult(true); setStatus('Resigned'); setThinking(false);
  };

  const buildPgn = useCallback(() => {
    const whiteName = playerColor === 'w' ? 'Player' : model?.name || 'AI';
    const blackName = playerColor === 'b' ? 'Player' : model?.name || 'AI';
    let resultToken = resultToPgnToken(game.getResult(), game.isGameOver());
    if (result && !game.isGameOver()) {
      resultToken = result === 'white' ? '1-0' : result === 'black' ? '0-1' : '1/2-1/2';
    }
    return exportPgn(game, {
      white: whiteName,
      black: blackName,
      result: resultToken,
      event: 'Casual Game',
    });
  }, [playerColor, model, result, tick]);

  const onCopyPgn = useCallback(async (): Promise<boolean> => {
    const text = buildPgn();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }, [buildPgn]);

  const onDownloadPgn = useCallback(() => {
    const text = buildPgn();
    const blob = new Blob([text], { type: 'application/x-chess-pgn' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pgnFilename(gameStartedAt.current);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [buildPgn]);

  return (
    <div className="app-shell">
      <AppSidebar active={view} onNavigate={setView} />
      <div className="main-area">
        {view === 'play' && (
          <div className="board-and-panel">
            <div className="board-column">
              <div style={{ display: 'flex', justifyContent: 'space-between', width: 'min(560px, 92vw)', fontSize: 13, color: 'var(--text-muted)' }}>
                <span>{orientation === 'w' ? 'Black' : 'White'} · {model?.name}</span>
                <span>{thinking ? 'Thinking…' : game.isCheck() ? 'Check!' : ''}</span>
              </div>
              <ChessBoard
                pieces={pieces} orientation={orientation} selected={selected}
                legalTargets={legalTargets} lastMove={game.getLastMove()}
                checkSquare={game.getKingInCheck()} premove={premoveRef.current.get()}
                arrows={annotRef.current.getArrows()} highlights={annotRef.current.getHighlights()}
                showCoordinates={settings.showCoordinates} showLegalMoves={settings.showLegalMoves}
                interactive={!game.isGameOver()} onSelectSquare={onSelectSquare} onMove={onMove}
                onArrow={(f, t) => { annotRef.current.addArrow(f, t); refresh(); }}
                onHighlight={(sq) => { annotRef.current.toggleHighlight(sq); refresh(); }}
                onClearAnnotations={() => { annotRef.current.clear(); refresh(); }}
                themeClass={`board-theme-${settings.boardTheme}`}
                animateMoves={settings.enableAnimations !== false}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', width: 'min(560px, 92vw)', fontSize: 13 }}>
                <span>{orientation === 'w' ? 'White' : 'Black'} · You</span>
                <span style={{ color: 'var(--text-muted)' }}>{game.getHistorySan().length} moves</span>
              </div>
            </div>
            <GamePanel model={model} thinking={thinking} status={status} error={error}
              canUndo={game.getHistorySan().length >= 2 && !thinking}
              gameOver={!!game.isGameOver() || !!result}
              onNewGame={newGame} onUndo={undo}
              onFlip={() => setOrientation((o) => (o === 'w' ? 'b' : 'w'))}
              onResign={resign}
              difficulty={settings.difficulty}
              onDifficultyChange={(d) =>
                setSettings((s) => ({ ...s, difficulty: d as AppSettings['difficulty'] }))
              }
              onClearArrows={() => { annotRef.current.clear(); refresh(); }}
              soundEnabled={settings.enableSounds}
              onToggleSound={() => {
                setSettings((s) => {
                  const next = !s.enableSounds;
                  soundManager.setEnabled(next);
                  return { ...s, enableSounds: next };
                });
              }}
              volume={soundManager.getVolume()}
              onVolumeChange={(v) => { soundManager.setVolume(v); setTick((x) => x + 1); }}
              moveHistory={game.getHistorySan()}
              onCopyPgn={onCopyPgn}
              onDownloadPgn={onDownloadPgn}
              playerColor={playerColor}
              isCheck={game.isCheck()} />
          </div>
        )}
        {view === 'opponents' && (
          <AIModelSelector selectedId={aiManager.getModelId()}
            onSelect={(id) => { aiManager.setModel(id); setSettings((s) => ({ ...s, defaultOpponent: id })); refresh(); }}
            hasGeminiKey={!!apiKeys.gemini} hasOpenRouterKey={!!apiKeys.openrouter} />
        )}
        {view === 'settings' && (
          <SettingsPanel settings={settings} onChange={setSettings} apiKeys={apiKeys}
            onSaveKey={(provider, key) => setApiKeys((k) => ({ ...k, [provider]: key }))}
            onClearKey={(provider) => setApiKeys((k) => { const n = { ...k }; delete n[provider]; return n; })} />
        )}
        {view === 'history' && (<div style={{ padding: 24 }}><h2>Game History</h2><p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Browser-local history (future).</p></div>)}
        {view === 'analysis' && (<div style={{ padding: 24 }}><h2>Analysis</h2><p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Use Stockfish as opponent for strong play.</p></div>)}
        {view === 'help' && (
          <div style={{ padding: 24, maxWidth: 640, lineHeight: 1.6 }}>
            <h2>About AIChess</h2>
            <p style={{ marginTop: 12 }}>Play against Stockfish with no API key, or Gemini / OpenRouter free models with your own key. Premoves and right-click arrows included.</p>
          </div>
        )}
      </div>
      {promotion && <PromotionDialog color={playerColor} onSelect={onPromotion} onCancel={() => setPromotion(null)} />}
      {showResult && result && <GameResultDialog result={result} onNewGame={newGame} onClose={() => setShowResult(false)} />}
    </div>
  );
}
