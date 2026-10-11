import { DEFAULT_THINK_SETTINGS, type ThinkMode } from './thinkTime';

export type UCIMove = string;

export interface AIMoveRequest {
  fen: string;
  legalMoves: string[];
  history: string[];
  sideToMove: 'w' | 'b';
  pgn?: string;
  timeoutMs?: number;
  difficulty?: number;
}

export interface AIMoveResponse {
  move: UCIMove;
  raw?: string;
  thinkingMs?: number;
}

export interface AIProvider {
  id: string;
  name: string;
  requiresKey: boolean;
  getMove(req: AIMoveRequest, apiKey?: string, signal?: AbortSignal): Promise<AIMoveResponse>;
  testConnection?(apiKey: string): Promise<boolean>;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  providerId: string;
  free: boolean;
  requiresKey: boolean;
  description?: string;
  context?: string;
  lastVerified?: string;
}

export type GameResult =
  | 'white'
  | 'black'
  | 'draw'
  | 'stalemate'
  | 'insufficient'
  | 'threefold'
  | 'fifty'
  | 'resign'
  | null;

export interface AppSettings {
  boardTheme: 'green' | 'brown' | 'blue' | 'purple';
  pieceTheme: 'maestro' | 'cburnett' | 'wikipedia';
  showCoordinates: boolean;
  showLegalMoves: boolean;
  showLastMove: boolean;
  enablePremoves: boolean;
  enableSounds: boolean;
  /** Bundled originals by default; the optional Chess.com pack loads at runtime. */
  soundPack: 'builtin' | 'chesscom';
  enableAnimations: boolean;
  defaultColor: 'w' | 'b' | 'random';
  defaultOpponent: string;
  aiTimeoutMs: number;
  /** How long an AI reply takes to appear: instant, difficulty-based, or custom. */
  thinkMode: ThinkMode;
  /** Custom pacing target in ms (used when thinkMode is 'custom'). */
  minThinkMs: number;
  stockfishDepth: number;
  stockfishTimeMs: number;
  rememberKeys: boolean;
  difficulty: 'beginner' | 'easy' | 'medium' | 'hard' | 'expert' | 'custom';
  customSkillLevel: number;
  customDepth: number;
  customMovetimeMs: number;
  /** Search depth used by the analysis view. */
  analysisDepth: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  boardTheme: 'green',
  pieceTheme: 'cburnett',
  showCoordinates: true,
  showLegalMoves: true,
  showLastMove: true,
  enablePremoves: true,
  enableSounds: true,
  soundPack: 'builtin',
  enableAnimations: true,
  defaultColor: 'w',
  defaultOpponent: 'stockfish',
  aiTimeoutMs: 30000,
  thinkMode: DEFAULT_THINK_SETTINGS.mode,
  minThinkMs: DEFAULT_THINK_SETTINGS.customMs,
  stockfishDepth: 12,
  stockfishTimeMs: 1500,
  rememberKeys: false,
  difficulty: 'medium',
  customSkillLevel: 10,
  customDepth: 10,
  customMovetimeMs: 500,
  analysisDepth: 12,
};
