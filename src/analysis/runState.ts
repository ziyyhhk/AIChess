/** State of one analysis run, kept in the app so the view stays a pure render. */
import type { AnalysisProgress, GameAnalysis } from './analyzeGame';

export type AnalysisStatus = 'idle' | 'running' | 'done' | 'error';

export interface AnalysisRunState {
  status: AnalysisStatus;
  progress: AnalysisProgress | null;
  result: GameAnalysis | null;
  error: string | null;
  /** Engine warning, e.g. Stockfish unavailable and the fallback in use. */
  warning: string | null;
  /** How many plies the analysed snapshot contained. */
  snapshotPlies: number;
  /** Move count of the live game when the snapshot was taken. */
  livePliesAtStart: number;
  /** Player names at the time of the snapshot. */
  players: { white: string; black: string };
  /** Selected ply for the review board. */
  selectedPly: number | null;
}

export const INITIAL_ANALYSIS_STATE: AnalysisRunState = {
  status: 'idle',
  progress: null,
  result: null,
  error: null,
  warning: null,
  snapshotPlies: 0,
  livePliesAtStart: 0,
  players: { white: 'White', black: 'Black' },
  selectedPly: null,
};
