/**
 * The ten move classifications and the artwork used for them.
 *
 * AIChess ships its own original SVG glyphs (drawn in `components/analysis/
 * MoveGlyph.tsx`), so the analysis view has no external dependency and nothing
 * to license. If you own a custom icon set, drop the files into
 * `public/assets/analysis/` using the file names below; the analysis view
 * probes for them at runtime and prefers them over the built-in glyphs. An
 * optional `manifest.json` in the same folder can map classifications to any
 * file name you like.
 *
 * Accent colours below were sampled from the custom circular icon set so the
 * move-list dots and evaluation graph stay in the same palette as the images.
 */
import type { MoveClassification } from './classification';

export interface ClassificationIcon {
  classification: MoveClassification;
  /** Accessible label; the UI always shows text as well as the glyph. */
  label: string;
  /** Accent colour, used for the move-list dots and the evaluation graph. */
  color: string;
  /** Expected file name in `public/assets/analysis/`. */
  fileName: string;
}

export const CLASSIFICATION_ICONS: Record<MoveClassification, ClassificationIcon> = {
  brilliant: { classification: 'brilliant', label: 'Brilliant', color: '#29bd9f', fileName: 'brilliant.png' },
  great: { classification: 'great', label: 'Great', color: '#739abd', fileName: 'great.png' },
  best: { classification: 'best', label: 'Best', color: '#7cac4b', fileName: 'best.png' },
  excellent: { classification: 'excellent', label: 'Excellent', color: '#738c5c', fileName: 'excellent.png' },
  good: { classification: 'good', label: 'Good', color: '#7fb04e', fileName: 'good.png' },
  book: { classification: 'book', label: 'Book', color: '#ca9e7a', fileName: 'book.png' },
  inaccuracy: { classification: 'inaccuracy', label: 'Inaccuracy', color: '#e7ba33', fileName: 'inaccuracy.png' },
  mistake: { classification: 'mistake', label: 'Mistake', color: '#f59e57', fileName: 'mistake.png' },
  blunder: { classification: 'blunder', label: 'Blunder', color: '#e5402e', fileName: 'blunder.png' },
  miss: { classification: 'miss', label: 'Miss', color: '#e76f63', fileName: 'miss.png' },
  forced: { classification: 'forced', label: 'Forced', color: '#8a94a6', fileName: 'forced.png' },
};

/** The ten classifications that have a dedicated supplied/external icon. */
export const TEN_CLASSIFICATIONS: MoveClassification[] = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'inaccuracy',
  'mistake',
  'blunder',
  'miss',
];

export type IconManifest = Partial<Record<MoveClassification, string>>;

export function analysisAssetsDir(): string {
  const base = (import.meta.env?.BASE_URL as string) || '/';
  const normalized = base.endsWith('/') ? base : `${base}/`;
  return `${normalized}assets/analysis/`;
}

export function iconAssetUrl(fileName: string): string {
  return `${analysisAssetsDir()}${fileName}`;
}

/**
 * Look for a user-supplied icon set. Returns a classification -> URL map, or an
 * empty object when the built-in glyphs should be used.
 */
export async function loadIconOverrides(
  fetchImpl: typeof fetch = fetch
): Promise<IconManifest> {
  const dir = analysisAssetsDir();
  try {
    const res = await fetchImpl(`${dir}manifest.json`, { cache: 'no-cache' });
    if (res.ok) {
      const data = (await res.json()) as IconManifest;
      const out: IconManifest = {};
      for (const key of Object.keys(data)) {
        const classification = key as MoveClassification;
        const file = data[classification];
        if (CLASSIFICATION_ICONS[classification] && typeof file === 'string' && file) {
          out[classification] = iconAssetUrl(file);
        }
      }
      return out;
    }
  } catch {
    /* fall through to probing */
  }

  const found: IconManifest = {};
  await Promise.all(
    TEN_CLASSIFICATIONS.map(async (classification) => {
      const url = iconAssetUrl(CLASSIFICATION_ICONS[classification].fileName);
      try {
        const res = await fetchImpl(url, { method: 'HEAD', cache: 'no-cache' });
        const type = res.headers?.get?.('content-type') ?? '';
        if (res.ok && (!type || type.startsWith('image/'))) found[classification] = url;
      } catch {
        /* not supplied, use the built-in glyph */
      }
    })
  );
  return found;
}
