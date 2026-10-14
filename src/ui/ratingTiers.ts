/**
 * Rating tiers with original SVG glyphs (no external assets).
 * AI rating is derived from difficulty target; human from Settings.
 */

export type RatingTierId =
  | 'unrated'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'diamond'
  | 'master'
  | 'grandmaster';

export interface RatingTier {
  id: RatingTierId;
  label: string;
  min: number;
  max: number;
  /** Fill colour for the glyph */
  color: string;
}

export const RATING_TIERS: RatingTier[] = [
  { id: 'unrated', label: 'Unrated', min: 0, max: 399, color: '#6b7280' },
  { id: 'bronze', label: 'Bronze', min: 400, max: 799, color: '#b45309' },
  { id: 'silver', label: 'Silver', min: 800, max: 1199, color: '#9ca3af' },
  { id: 'gold', label: 'Gold', min: 1200, max: 1599, color: '#d4a017' },
  { id: 'platinum', label: 'Platinum', min: 1600, max: 1999, color: '#67e8f9' },
  { id: 'diamond', label: 'Diamond', min: 2000, max: 2399, color: '#38bdf8' },
  { id: 'master', label: 'Master', min: 2400, max: 2699, color: '#a78bfa' },
  { id: 'grandmaster', label: 'Grandmaster', min: 2700, max: 9999, color: '#f472b6' },
];

export function tierForRating(rating: number | null | undefined): RatingTier {
  if (rating == null || Number.isNaN(rating) || rating < 0) return RATING_TIERS[0];
  for (const t of RATING_TIERS) {
    if (rating >= t.min && rating <= t.max) return t;
  }
  return RATING_TIERS[RATING_TIERS.length - 1];
}

/** Map Stockfish difficulty target rating (from DifficultyProfile). */
export function ratingFromDifficulty(difficulty: string): number {
  switch (difficulty) {
    case 'beginner':
      return 600;
    case 'easy':
      return 900;
    case 'medium':
      return 1300;
    case 'hard':
      return 1700;
    case 'expert':
      return 2200;
    default:
      return 1500;
  }
}
