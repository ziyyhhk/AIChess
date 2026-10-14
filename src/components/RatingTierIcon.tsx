import { tierForRating, type RatingTier } from '../ui/ratingTiers';

interface Props {
  rating: number | null | undefined;
  size?: number;
  className?: string;
  title?: string;
}

/** Original geometric tier glyph — restrained, no emoji. */
export function RatingTierIcon({ rating, size = 16, className = '', title }: Props) {
  const tier = tierForRating(rating);
  const label = title ?? `${tier.label}${rating != null ? ` · ${Math.round(rating)}` : ''}`;
  return (
    <span
      className={`rating-tier-icon ${className}`}
      title={label}
      aria-label={label}
      style={{ display: 'inline-flex', verticalAlign: 'middle', lineHeight: 0 }}
    >
      <TierSvg tier={tier} size={size} />
    </span>
  );
}

function TierSvg({ tier, size }: { tier: RatingTier; size: number }) {
  const c = tier.color;
  switch (tier.id) {
    case 'unrated':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
          <circle cx="8" cy="8" r="5.5" fill="none" stroke={c} strokeWidth="1.5" />
        </svg>
      );
    case 'bronze':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
          <polygon points="8,2 14,14 2,14" fill={c} />
        </svg>
      );
    case 'silver':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
          <rect x="3" y="3" width="10" height="10" rx="1.5" fill={c} />
        </svg>
      );
    case 'gold':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
          <polygon points="8,1.5 10,6 15,6.5 11,10 12.5,15 8,12.5 3.5,15 5,10 1,6.5 6,6" fill={c} />
        </svg>
      );
    case 'platinum':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
          <polygon points="8,2 13,5.5 13,10.5 8,14 3,10.5 3,5.5" fill={c} />
        </svg>
      );
    case 'diamond':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
          <polygon points="8,1.5 14.5,8 8,14.5 1.5,8" fill={c} />
        </svg>
      );
    case 'master':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
          <path d="M2 12 L4 4 L8 9 L12 4 L14 12 Z" fill={c} />
        </svg>
      );
    case 'grandmaster':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
          <path
            d="M8 1.5 L9.5 5.5 L14 5.5 L10.5 8.5 L12 13 L8 10.5 L4 13 L5.5 8.5 L2 5.5 L6.5 5.5 Z"
            fill={c}
          />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
          <circle cx="8" cy="8" r="5" fill={c} />
        </svg>
      );
  }
}
