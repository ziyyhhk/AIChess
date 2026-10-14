/**
 * Move classifications and original glyph colours.
 * All artwork is drawn in MoveGlyph.tsx as inline SVG — no external URLs.
 */
import type { MoveClassification } from './classification';

export interface ClassificationIcon {
  classification: MoveClassification;
  label: string;
  color: string;
  fileName: string;
}

export const CLASSIFICATION_ICONS: Record<MoveClassification, ClassificationIcon> = {
  brilliant: { classification: 'brilliant', label: 'Brilliant', color: '#1abc9c', fileName: 'brilliant.png' },
  great: { classification: 'great', label: 'Very good', color: '#5b8def', fileName: 'great.png' },
  best: { classification: 'best', label: 'Best', color: '#6ab04c', fileName: 'best.png' },
  excellent: { classification: 'excellent', label: 'Excellent', color: '#7cb342', fileName: 'excellent.png' },
  good: { classification: 'good', label: 'Good', color: '#7d9b5a', fileName: 'good.png' },
  book: { classification: 'book', label: 'Theoretical', color: '#c4a484', fileName: 'book.png' },
  inaccuracy: { classification: 'inaccuracy', label: 'Inaccuracy', color: '#f1c40f', fileName: 'inaccuracy.png' },
  mistake: { classification: 'mistake', label: 'Mistake', color: '#f39c12', fileName: 'mistake.png' },
  blunder: { classification: 'blunder', label: 'Blunder', color: '#e74c3c', fileName: 'blunder.png' },
  miss: { classification: 'miss', label: 'Miss', color: '#e57373', fileName: 'miss.png' },
  forced: { classification: 'forced', label: 'Forced', color: '#8a94a6', fileName: 'forced.png' },
};

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

/** Report panel row order (Priority 4). */
export const REPORT_CATEGORY_ORDER: MoveClassification[] = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'inaccuracy',
  'mistake',
  'blunder',
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
    /* fall through */
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
        /* use built-in */
      }
    })
  );
  return found;
}
