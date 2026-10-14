/** Piece image sets bundled under public/assets/pieces/ */
export type PieceSetId = 'cburnett' | 'maestro' | 'wikipedia';

export const PIECE_SETS: { id: PieceSetId; name: string; ext: 'svg' | 'png' }[] = [
  { id: 'cburnett', name: 'CBurnett', ext: 'svg' },
];

const base = () => {
  const b = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
  return b.endsWith('/') ? b : b + '/';
};

/** Always resolve to a set that has files on disk. */
function resolveSet(set: PieceSetId): { id: string; ext: 'svg' | 'png' } {
  // Only cburnett is fully shipped; others fall back so images never 404.
  if (set === 'cburnett') return { id: 'cburnett', ext: 'svg' };
  return { id: 'cburnett', ext: 'svg' };
}

export function pieceSrc(
  color: 'w' | 'b',
  type: string,
  set: PieceSetId = 'cburnett'
): string {
  const key = `${color}${type.toUpperCase()}`;
  const meta = resolveSet(set);
  return `${base()}assets/pieces/${meta.id}/${key}.${meta.ext}`;
}
