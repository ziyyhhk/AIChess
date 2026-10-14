/**
 * Rating tiers for the player and opponent icons.
 *
 * Six tiers, each named after a chess piece. The thresholds are placeholders the
 * owner will adjust. They live only in RATING_TIERS, and every other part of the
 * app reads from here. Tiers must stay contiguous: each minRating is the previous
 * maxRating plus one. The tests enforce this.
 */
export type RatingTierId = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';

export interface RatingTier {
  id: RatingTierId;
  label: string;
  /** Lowest rating in the tier, inclusive. */
  minRating: number;
  /** Highest rating in the tier, inclusive. Null means no upper bound. */
  maxRating: number | null;
  /** Flat accent colour. The label is always shown too, so colour is never the only signal. */
  color: string;
}

export const RATING_TIERS: readonly RatingTier[] = [
  { id: 'pawn', label: 'Pawn', minRating: 0, maxRating: 799, color: '#8d9aa6' },
  { id: 'knight', label: 'Knight', minRating: 800, maxRating: 1199, color: '#7fae55' },
  { id: 'bishop', label: 'Bishop', minRating: 1200, maxRating: 1599, color: '#3fb0a6' },
  { id: 'rook', label: 'Rook', minRating: 1600, maxRating: 1999, color: '#5b93d6' },
  { id: 'queen', label: 'Queen', minRating: 2000, maxRating: 2399, color: '#d4a72c' },
  { id: 'king', label: 'King', minRating: 2400, maxRating: null, color: '#cc6b5a' },
];

/** The tier for a rating, or null when there is no usable rating. */
export function tierForRating(rating: number | null | undefined): RatingTier | null {
  if (rating == null || !Number.isFinite(rating) || rating < 0) return null;
  for (let i = RATING_TIERS.length - 1; i >= 0; i--) {
    if (rating >= RATING_TIERS[i].minRating) return RATING_TIERS[i];
  }
  return RATING_TIERS[0];
}

/** Human-readable range: "under 800", "800–1199" or "2400 and up". */
export function formatTierRange(tier: RatingTier): string {
  if (tier.maxRating == null) return `${tier.minRating} and up`;
  if (tier.minRating === 0) return `under ${tier.maxRating + 1}`;
  return `${tier.minRating}–${tier.maxRating}`;
}

/**
 * Read a rating from a PGN header such as WhiteElo. Returns null for missing or
 * placeholder values such as "?".
 */
export function parseRatingHeader(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = Number.parseInt(value.trim(), 10);
  return Number.isFinite(n) && n > 0 && n < 4000 ? n : null;
}
