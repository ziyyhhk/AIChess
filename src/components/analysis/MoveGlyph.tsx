import React from 'react';
import {
  CLASSIFICATION_ICONS,
  TEN_CLASSIFICATIONS,
  type IconManifest,
} from '../../analysis/iconAssets';
import type { MoveClassification } from '../../analysis/classification';

/**
 * Classification glyph: solid disc + original white mark.
 * Shapes are original vector art (no external assets, no chess.com files).
 */
export function MoveGlyph({
  classification,
  size = 18,
  overrides,
  className,
}: {
  classification: MoveClassification;
  size?: number;
  overrides?: IconManifest;
  className?: string;
}) {
  const icon = CLASSIFICATION_ICONS[classification];
  const override = overrides?.[classification];
  const shared = {
    width: size,
    height: size,
    className: ['move-glyph', className].filter(Boolean).join(' '),
    role: 'img' as const,
    'aria-label': icon.label,
    'data-classification': classification,
  };

  if (override) {
    return <img src={override} {...shared} alt={icon.label} />;
  }

  return (
    <svg viewBox="0 0 24 24" {...shared} aria-label={icon.label}>
      <circle cx="12" cy="12" r="12" fill={icon.color} />
      {Marks[classification]}
    </svg>
  );
}

/** Filled white marks on a 24x24 disc. Original shapes only. */
const Marks: Record<MoveClassification, React.ReactNode> = {
  // Brilliant — double bang
  brilliant: (
    <g fill="#ffffff">
      <rect x="6.2" y="5.2" width="3.4" height="10.2" rx="1.2" />
      <rect x="6.6" y="17.2" width="2.6" height="2.6" rx="0.6" />
      <rect x="14.4" y="5.2" width="3.4" height="10.2" rx="1.2" />
      <rect x="14.8" y="17.2" width="2.6" height="2.6" rx="0.6" />
    </g>
  ),
  // Great / Very good — single bang
  great: (
    <g fill="#ffffff">
      <rect x="10.3" y="4.8" width="3.4" height="11.2" rx="1.2" />
      <rect x="10.7" y="17.4" width="2.6" height="2.6" rx="0.6" />
    </g>
  ),
  // Best — five-point star
  best: (
    <path
      fill="#ffffff"
      d="M12 4.2 L13.9 9.6 L19.6 9.8 L15.1 13.3 L16.6 18.8 L12 15.8 L7.4 18.8 L8.9 13.3 L4.4 9.8 L10.1 9.6 Z"
    />
  ),
  // Excellent — thumbs up
  excellent: (
    <g fill="#ffffff">
      <path d="M8.2 11.2 L8.2 18.2 L6.4 18.2 C5.7 18.2 5.2 17.7 5.2 17 L5.2 12.4 C5.2 11.7 5.7 11.2 6.4 11.2 Z" />
      <path d="M8.2 11.2 L10.4 11.2 L10.4 7.6 C10.4 6.3 11.4 5.4 12.6 5.6 C13.4 5.8 13.8 6.6 13.6 7.4 L13.2 10.2 L17.4 10.2 C18.4 10.2 19.1 11.2 18.8 12.2 L17.2 17.4 C17 18 16.4 18.4 15.7 18.4 L8.2 18.4 Z" />
    </g>
  ),
  // Good — check mark
  good: (
    <path
      fill="#ffffff"
      d="M6.2 12.4 L10.2 16.4 L17.8 7.8 L16.2 6.4 L10.2 13.4 L7.6 10.8 Z"
    />
  ),
  // Book / Theoretical — open book
  book: (
    <g fill="#ffffff">
      <path d="M5.4 7.2 C7.6 6 10 6 11.6 7.2 L11.6 17.4 C10 16.4 7.6 16.4 5.4 17.6 Z" />
      <path d="M18.6 7.2 C16.4 6 14 6 12.4 7.2 L12.4 17.4 C14 16.4 16.4 16.4 18.6 17.6 Z" />
      <path fill="none" stroke="#ffffff" strokeWidth="1.2" d="M12 7.4 L12 17.2" />
    </g>
  ),
  // Inaccuracy — ?!
  inaccuracy: (
    <g fill="#ffffff">
      <path d="M7.2 8.2 C7.2 6.2 8.8 5 10.6 5 C12.4 5 14 6.2 14 8.2 C14 9.6 13.2 10.4 12.2 11.2 C11.4 11.8 11 12.4 11 13.4 L9.2 13.4 C9.2 11.8 9.8 11 10.8 10.2 C11.6 9.6 12.2 9.2 12.2 8.2 C12.2 7.2 11.4 6.6 10.6 6.6 C9.8 6.6 9 7.2 9 8.2 Z" />
      <rect x="9.4" y="15.4" width="2.4" height="2.4" rx="0.5" />
      <rect x="15.4" y="5.2" width="2.8" height="9.6" rx="1" />
      <rect x="15.6" y="16.2" width="2.4" height="2.4" rx="0.5" />
    </g>
  ),
  // Mistake — single ?
  mistake: (
    <g fill="#ffffff">
      <path d="M8.6 8.4 C8.6 5.8 10.6 4.2 13 4.2 C15.4 4.2 17.4 5.8 17.4 8.4 C17.4 10.2 16.2 11.2 14.8 12.2 C13.6 13 13 13.8 13 15.2 L10.8 15.2 C10.8 13.2 11.6 12.2 13 11.2 C14.2 10.4 15.2 9.8 15.2 8.4 C15.2 7 14.2 6.2 13 6.2 C11.8 6.2 10.8 7 10.8 8.4 Z" />
      <rect x="11.4" y="17" width="2.6" height="2.6" rx="0.5" />
    </g>
  ),
  // Blunder — ??
  blunder: (
    <g fill="#ffffff">
      <path d="M4.8 8.6 C4.8 6.6 6.2 5.4 8 5.4 C9.8 5.4 11.2 6.6 11.2 8.6 C11.2 10 10.4 10.8 9.4 11.4 C8.6 12 8.2 12.6 8.2 13.6 L6.4 13.6 C6.4 12.2 7 11.4 8 10.6 C8.8 10 9.4 9.6 9.4 8.6 C9.4 7.6 8.8 7 8 7 C7.2 7 6.6 7.6 6.6 8.6 Z" />
      <rect x="6.6" y="15.4" width="2.2" height="2.2" rx="0.4" />
      <path d="M13.2 8.6 C13.2 6.6 14.6 5.4 16.4 5.4 C18.2 5.4 19.6 6.6 19.6 8.6 C19.6 10 18.8 10.8 17.8 11.4 C17 12 16.6 12.6 16.6 13.6 L14.8 13.6 C14.8 12.2 15.4 11.4 16.4 10.6 C17.2 10 17.8 9.6 17.8 8.6 C17.8 7.6 17.2 7 16.4 7 C15.6 7 15 7.6 15 8.6 Z" />
      <rect x="15" y="15.4" width="2.2" height="2.2" rx="0.4" />
    </g>
  ),
  // Miss — X
  miss: (
    <path
      fill="#ffffff"
      d="M7.2 6.4 L12 11.2 L16.8 6.4 L18.2 7.8 L13.4 12.6 L18.2 17.4 L16.8 18.8 L12 14 L7.2 18.8 L5.8 17.4 L10.6 12.6 L5.8 7.8 Z"
    />
  ),
  // Forced — short bar
  forced: (
    <rect x="7.5" y="10.5" width="9" height="3" rx="1.2" fill="#ffffff" />
  ),
};

export function hasSuppliedIcon(
  classification: MoveClassification,
  overrides?: IconManifest
): boolean {
  return !!overrides?.[classification];
}

export { TEN_CLASSIFICATIONS };
