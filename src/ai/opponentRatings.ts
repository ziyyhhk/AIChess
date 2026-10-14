/**
 * The rating each side shows in analysis and in the game panel.
 *
 * - The player's side uses the rating they entered in Settings (null until then).
 * - A bot uses its ELO.
 * - A built-in engine level uses that level's target rating.
 * - A hosted AI model has no known strength, so it gets null and no icon.
 */
import { difficultyToSettings, type StockfishDifficulty } from './providers/stockfishAdapter';
import type { Bot } from './bots';

export interface SideRatings {
  white: number | null;
  black: number | null;
}

export interface RatingContext {
  playerColor: 'w' | 'b';
  humanRating: number | null;
  bot: Bot | null;
  /** True when the built-in engine is the opponent (not a hosted model). */
  engineOpponent: boolean;
  difficulty: string;
}

export function ratingsForGame(ctx: RatingContext): SideRatings {
  const opponent: number | null = ctx.bot
    ? ctx.bot.elo
    : ctx.engineOpponent
      ? difficultyToSettings(ctx.difficulty as StockfishDifficulty).targetRating
      : null;
  const human = ctx.humanRating ?? null;
  return ctx.playerColor === 'w'
    ? { white: human, black: opponent }
    : { white: opponent, black: human };
}
