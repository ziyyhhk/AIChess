/**
 * Rating tiers for player/AI panels.
 * Numbers are approximate placeholders — adjust as needed.
 */
export type RatingTierId = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface RatingTier {
  id: RatingTierId;
  label: string;
  minRating: number;
  maxRating: number | null;
  /** Flat accent colour (not the only signal — label is always shown). */
  color: string;
}

export const RATING_TIERS: RatingTier[] = [
  { id: 'beginner', label: 'Beginner', minRating: 0, maxRating: 799, color: '#6f9e4e' },
  { id: 'intermediate', label: 'Intermediate', minRating: 800, maxRating: 1399, color: '#5a8fbf' },
  { id: 'advanced', label: 'Advanced', minRating: 1400, maxRating: 1999, color: '#c9a227' },
  { id: 'expert', label: 'Expert', minRating: 2000, maxRating: null, color: '#c45c5c' },
];

export function tierForRating(rating: number | null | undefined): RatingTier | null {
  if (rating == null || !Number.isFinite(rating) || rating < 0) return null;
  for (let i = RATING_TIERS.length - 1; i >= 0; i--) {
    if (rating >= RATING_TIERS[i].minRating) return RATING_TIERS[i];
  }
  return RATING_TIERS[0];
}

/** Map Stockfish difficulty to an approximate target rating for the tier icon. */
export function ratingForDifficulty(d: string): number {
  switch (d) {
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
      return 1300;
  }
}
