import React from 'react';
import { formatTierRange, tierForRating, type RatingTier, type RatingTierId } from './ratingTiers';

/*
 * Original rating-tier glyphs. Each one is a dark tile with a piece silhouette in
 * the tier's accent colour, a short up-pointing arrow at the lower left, and a
 * circular badge at the upper right. Every shape is drawn here. No third-party
 * artwork is used, and no external URLs appear in this file.
 */

const TILE = '#1d232b';
const TILE_EDGE = '#333c48';
const PIECE_EDGE = '#0e1217';
const BASE_Y = 17.2;

function PieceShape({ id }: { id: RatingTierId }) {
  const base = <rect x="6.5" y={BASE_Y} width="11" height="2.8" rx="0.9" />;
  switch (id) {
    case 'pawn':
      return (
        <g>
          <circle cx="12" cy="7.8" r="2.6" />
          <rect x="8.6" y="10.6" width="6.8" height="1.6" rx="0.8" />
          <path d="M9.9 11.9C9.8 13.6 8.4 14.8 8.1 17.2H15.9C15.6 14.8 14.2 13.6 14.1 11.9Z" />
          {base}
        </g>
      );
    case 'knight':
      return (
        <g>
          <path d="M7.2 17.2V13.4C7.2 11.7 7.9 10.6 6.6 8.6C7.4 7.6 9 6.8 9.6 5.2L10.6 3.8L12.2 4.6C15.2 5.6 17.2 8.4 17.2 11.8V17.2Z" />
          <circle cx="10.5" cy="8.4" r="0.85" fill={TILE} stroke="none" />
          {base}
        </g>
      );
    case 'bishop':
      return (
        <g>
          <path d="M12 3.6C10.4 5.2 9.2 6.8 9.4 9.2C9.6 11 10.6 11.6 10.4 13.2H13.6C13.4 11.6 14.4 11 14.6 9.2C14.8 6.8 13.6 5.2 12 3.6Z" />
          <path d="M10.6 7.2L13.4 9.4" fill="none" stroke={TILE} strokeWidth="0.9" />
          <rect x="9.2" y="13.2" width="5.6" height="1.5" rx="0.7" />
          <path d="M10.2 14.9L8.6 17.2H15.4L13.8 14.9Z" />
          {base}
        </g>
      );
    case 'rook':
      return (
        <g>
          <rect x="7.4" y="4" width="2.6" height="3" />
          <rect x="10.7" y="4" width="2.6" height="3" />
          <rect x="14" y="4" width="2.6" height="3" />
          <path d="M8.6 7H15.4V16.2L14.6 17.2H9.4L8.6 16.2Z" />
          {base}
        </g>
      );
    case 'queen':
      return (
        <g>
          <circle cx="6.8" cy="7" r="1.3" />
          <circle cx="12" cy="4.6" r="1.5" />
          <circle cx="17.2" cy="7" r="1.3" />
          <path d="M7.2 16.2L6.4 9.2L9.6 11.8L12 7.6L14.4 11.8L17.6 9.2L16.8 16.2Z" />
          {base}
        </g>
      );
    case 'king':
      return (
        <g>
          <rect x="11.1" y="1.8" width="1.8" height="5.2" />
          <rect x="9.4" y="3.3" width="5.2" height="1.6" />
          <path d="M9.4 17.2L9.6 13.4C8.4 12.4 8.6 9.6 10.2 8.6V7.4H13.8V8.6C15.4 9.6 15.6 12.4 14.4 13.4L14.6 17.2Z" />
          {base}
        </g>
      );
    default:
      return null;
  }
}

function TierGlyph({ tier, size, description }: { tier: RatingTier; size: number; description: string }) {
  return (
    <svg
      className="rating-tier-glyph"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={description}
      focusable="false"
    >
      <rect x="1" y="1" width="22" height="22" rx="4" fill={TILE} stroke={TILE_EDGE} strokeWidth="1" />
      <g fill={tier.color} stroke={PIECE_EDGE} strokeWidth="0.6" strokeLinejoin="round" paintOrder="stroke">
        <PieceShape id={tier.id} />
      </g>
      <path d="M4.6 20.4V15.4" fill="none" stroke={tier.color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4.6 13.2L7 16.2H2.2Z" fill={tier.color} />
      <circle cx="20.1" cy="3.9" r="2.6" fill={tier.color} stroke={TILE} strokeWidth="1.2" />
    </svg>
  );
}

interface Props {
  rating: number | null | undefined;
  size?: number;
  /** Show the tier name and range as visible text beside the glyph. */
  showLabel?: boolean;
}

/**
 * The rating-tier icon for a player or opponent. Renders nothing when there is
 * no rating, so a player who has not entered one sees no icon at all.
 */
export function RatingTierIcon({ rating, size = 22, showLabel = false }: Props) {
  const tier = tierForRating(rating);
  if (!tier) return null;
  const range = formatTierRange(tier);
  const description = `${tier.label}, rating ${range}`;
  return (
    <span className="rating-tier" title={`${tier.label}, ${range}`}>
      <span aria-hidden={showLabel || undefined}>
        <TierGlyph tier={tier} size={size} description={showLabel ? '' : description} />
      </span>
      {showLabel && (
        <span className="rating-tier-label">
          {tier.label}, {range}
        </span>
      )}
    </span>
  );
}
