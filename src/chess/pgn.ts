import type { GameController } from './gameController';

export interface PgnMeta {
  white?: string;
  black?: string;
  result?: string;
  date?: string;
  event?: string;
  site?: string;
  round?: string;
  /** Written as WhiteElo / BlackElo only when a rating is known. */
  whiteElo?: number | null;
  blackElo?: number | null;
}

/** Escape a PGN header value (quotes and backslashes). */
function escapeHeader(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Format a Date as YYYY.MM.DD for PGN. */
export function pgnDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

/**
 * Map GameController result to a standard PGN result token.
 * GameController returns 'white' | 'black' | 'stalemate' | 'insufficient' | ...
 */
export function resultToPgnToken(
  result: string | null,
  isGameOver: boolean
): string {
  if (!isGameOver || result == null) return '*';
  if (result === 'white') return '1-0';
  if (result === 'black') return '0-1';
  // All draw-ish outcomes
  return '1/2-1/2';
}

/**
 * Build a complete, valid PGN string for the current game.
 * Uses chess.js's authoritative SAN via game.getPgn() when possible,
 * and always includes standard headers + the correct result token.
 */
export function exportPgn(game: GameController, meta: PgnMeta = {}): string {
  const resultToken =
    meta.result ??
    resultToPgnToken(game.getResult(), game.isGameOver());

  const headers: [string, string][] = [
    ['Event', meta.event || 'Casual Game'],
    ['Site', meta.site || 'AIChess'],
    ['Date', meta.date || pgnDate()],
    ['Round', meta.round || '-'],
    ['White', meta.white || 'Player'],
    ['Black', meta.black || 'AI'],
    ['Result', resultToken],
    ...(meta.whiteElo ? ([['WhiteElo', String(meta.whiteElo)]] as [string, string][]) : []),
    ...(meta.blackElo ? ([['BlackElo', String(meta.blackElo)]] as [string, string][]) : []),
  ];

  const headerBlock = headers
    .map(([k, v]) => `[${k} "${escapeHeader(v)}"]`)
    .join('\n');

  // chess.js pgn() returns the move body (and may include a result).
  // Prefer our explicit result token for consistency.
  let body = game.getPgn().trim();
  // Strip a trailing result token if present so we control it.
  body = body.replace(/\s*(1-0|0-1|1\/2-1\/2|\*)\s*$/, '').trim();

  if (!body) {
    return `${headerBlock}\n\n${resultToken}\n`;
  }

  return `${headerBlock}\n\n${body} ${resultToken}\n`;
}

/**
 * Suggested download filename for a PGN export.
 */
export function pgnFilename(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `aichess-game-${y}-${m}-${d}.pgn`;
}
