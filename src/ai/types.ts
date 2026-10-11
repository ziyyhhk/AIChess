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
  enableAnimations: boolean;
  defaultColor: 'w' | 'b' | 'random';
  defaultOpponent: string;
  aiTimeoutMs: number;
  stockfishDepth: number;
  stockfishTimeMs: number;
  rememberKeys: boolean;
  difficulty: 'beginner' | 'easy' | 'medium' | 'hard' | 'expert' | 'custom';
  customSkillLevel: number;
  customDepth: number;
  customMovetimeMs: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  boardTheme: 'green',
  pieceTheme: 'cburnett',
  showCoordinates: true,
  showLegalMoves: true,
  showLastMove: true,
  enablePremoves: true,
  enableSounds: true,
  enableAnimations: true,
  defaultColor: 'w',
  defaultOpponent: 'stockfish',
  aiTimeoutMs: 30000,
  stockfishDepth: 12,
  stockfishTimeMs: 1500,
  rememberKeys: false,
  difficulty: 'medium',
  customSkillLevel: 10,
  customDepth: 10,
  customMovetimeMs: 500,
};
