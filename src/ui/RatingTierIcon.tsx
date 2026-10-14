import React from 'react';
import { tierForRating, type RatingTier } from './ratingTiers';

interface Props {
  rating: number | null | undefined;
  size?: number;
}

/**
 * Original tier glyph: dark tile, piece silhouette, arrow, circular badge.
 * Not copied from any third-party asset.
 */
function TierGlyph({ tier, size = 22 }: { tier: RatingTier; size?: number }) {
  const s = size;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      role="img"
      aria-label={`${tier.label} (${tier.minRating}${tier.maxRating != null ? `–${tier.maxRating}` : '+'})`}
    >
      <title>
        {tier.label} · {tier.minRating}
        {tier.maxRating != null ? `–${tier.maxRating}` : '+'}
      </title>
      <rect x="1" y="1" width="22" height="22" rx="3" fill="#1a1e24" stroke="#2e3540" strokeWidth="1" />
      <path
        d="M12 5.5c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm-2.8 5.2h5.6c.9 0 1.5.7 1.3 1.5l-.7 3.3h-6.8l-.7-3.3c-.2-.8.4-1.5 1.3-1.5zM8.5 16.5h7v1.2c0 .4-.3.8-.8.8H9.3c-.5 0-.8-.4-.8-.8v-1.2z"
        fill={tier.color}
      />
      <path
        d="M19 8l1.2 1.2L18.5 11H17l1.7-1.8L17 7.4 19 8z"
        fill={tier.color}
        opacity="0.85"
      />
      <circle cx="5.5" cy="18.5" r="2.2" fill={tier.color} opacity="0.9" />
    </svg>
  );
}

export function RatingTierIcon({ rating, size = 22 }: Props) {
  const tier = tierForRating(rating);
  if (!tier) return null;
  const range =
    tier.maxRating != null ? `${tier.minRating}–${tier.maxRating}` : `${tier.minRating}+`;
  return (
    <span
      className="rating-tier-icon"
      title={`${tier.label} (${range})`}
      style={{ display: 'inline-flex', verticalAlign: 'middle', marginLeft: 6 }}
    >
      <TierGlyph tier={tier} size={size} />
      <span className="sr-only">
        {tier.label}, rating range {range}
      </span>
    </span>
  );
}
