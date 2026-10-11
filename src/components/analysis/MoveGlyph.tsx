import React from 'react';
import {
  CLASSIFICATION_ICONS,
  TEN_CLASSIFICATIONS,
  type IconManifest,
} from '../../analysis/iconAssets';
import type { MoveClassification } from '../../analysis/classification';

/**
 * The classification glyph: a solid disc with a white mark.
 *
 * All ten marks are drawn as original vector shapes - no emoji, no external
 * files. When the user drops their own icon set into `public/assets/analysis/`
 * the same component shows that image instead (see analysis/iconAssets.ts).
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
      <g
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {Marks[classification]}
      </g>
    </svg>
  );
}

const BOLD = { strokeWidth: 2.6 } as const;

/** Vector marks, drawn on a 24x24 grid inside the disc. */
const Marks: Record<MoveClassification, React.ReactNode> = {
  // A four-point spark: the move gave something up and still worked.
  brilliant: (
    <>
      <path d="M12 5.2 L13.5 10.5 L18.8 12 L13.5 13.5 L12 18.8 L10.5 13.5 L5.2 12 L10.5 10.5 Z" fill="#ffffff" stroke="none" />
    </>
  ),
  // A double chevron: a strong find.
  great: (
    <>
      <path d="M7.5 13 L12 8.5 L16.5 13" style={BOLD} />
      <path d="M7.5 18 L12 13.5 L16.5 18" style={BOLD} />
    </>
  ),
  // A star: the engine's first choice.
  best: (
    <>
      <path
        d="M12 5 L13.8 10 L19 10.2 L14.9 13.4 L16.4 18.4 L12 15.5 L7.6 18.4 L9.1 13.4 L5 10.2 L10.2 10 Z"
        fill="#ffffff"
        stroke="none"
      />
    </>
  ),
  excellent: <path d="M6.5 12.6 L10.4 16.4 L17.5 8.6" style={BOLD} />,
  good: (
    <>
      <circle cx="12" cy="12" r="3.4" fill="#ffffff" stroke="none" />
    </>
  ),
  // An open book.
  book: (
    <>
      <path d="M5.5 7.5 C7.5 6.4 9.6 6.4 11.4 7.4 L11.4 17.2 C9.6 16.2 7.5 16.2 5.5 17.3 Z" fill="#ffffff" stroke="none" />
      <path d="M18.5 7.5 C16.5 6.4 14.4 6.4 12.6 7.4 L12.6 17.2 C14.4 16.2 16.5 16.2 18.5 17.3 Z" fill="#ffffff" stroke="none" />
    </>
  ),
  // ?!
  inaccuracy: (
    <>
      <path d="M7.6 9.4 a2.1 2.1 0 1 1 3 1.9 c-.8.4-1.2 1-1.2 1.9" />
      <circle cx="9.4" cy="15.7" r="1.05" fill="#ffffff" stroke="none" />
      <path d="M16.2 7.6 L16.2 13.2" style={BOLD} />
      <circle cx="16.2" cy="16.4" r="1.05" fill="#ffffff" stroke="none" />
    </>
  ),
  // A single question mark.
  mistake: (
    <>
      <path d="M8.6 9.4 a3.4 3.4 0 1 1 4.9 3.1 c-1.1.6-1.7 1.3-1.7 2.6" style={BOLD} />
      <circle cx="11.8" cy="18" r="1.15" fill="#ffffff" stroke="none" />
    </>
  ),
  // ??
  blunder: (
    <>
      <path d="M5.8 9.6 a2 2 0 1 1 2.9 1.8 c-.7.4-1.1.9-1.1 1.7" />
      <circle cx="7.6" cy="15.5" r="1" fill="#ffffff" stroke="none" />
      <path d="M15.3 9.6 a2 2 0 1 1 2.9 1.8 c-.7.4-1.1.9-1.1 1.7" />
      <circle cx="17.1" cy="15.5" r="1" fill="#ffffff" stroke="none" />
    </>
  ),
  // A cross: a clear chance was passed over.
  miss: (
    <>
      <path d="M7.8 7.8 L16.2 16.2" style={BOLD} />
      <path d="M16.2 7.8 L7.8 16.2" style={BOLD} />
    </>
  ),
  // A bar: nothing to choose.
  forced: (
    <>
      <path d="M9 12 L15 12" style={BOLD} />
    </>
  ),
};

export function hasSuppliedIcon(
  classification: MoveClassification,
  overrides?: IconManifest
): boolean {
  return !!overrides?.[classification];
}

export { TEN_CLASSIFICATIONS };
