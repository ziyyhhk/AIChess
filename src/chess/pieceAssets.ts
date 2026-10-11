/** Piece image sets bundled under public/assets/pieces/ */
export type PieceSetId = 'maestro' | 'cburnett' | 'wikipedia';

export const PIECE_SETS: { id: PieceSetId; name: string; ext: 'svg' | 'png' }[] = [
  { id: 'cburnett', name: 'CBurnett', ext: 'svg' },
  { id: 'maestro', name: 'Maestro', ext: 'svg' },
  { id: 'wikipedia', name: 'Wikipedia', ext: 'png' },
];

const base = () => {
  const b = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
  return b.endsWith('/') ? b : b + '/';
};

export function pieceSrc(
  color: 'w' | 'b',
  type: string,
  set: PieceSetId = 'cburnett'
): string {
  const key = `${color}${type.toUpperCase()}`;
  const meta = PIECE_SETS.find((s) => s.id === set) || PIECE_SETS[0];
  return `${base()}assets/pieces/${meta.id}/${key}.${meta.ext}`;
}
