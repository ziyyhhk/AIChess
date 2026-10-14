import { describe, it, expect } from 'vitest';
import {
  CLASSIFICATION_ICONS,
  TEN_CLASSIFICATIONS,
  iconAssetUrl,
  loadIconOverrides,
} from '../analysis/iconAssets';
import { CLASSIFICATIONS } from '../analysis/classification';

describe('classification icons', () => {
  it('has a labelled icon for every classification', () => {
    for (const classification of CLASSIFICATIONS) {
      const icon = CLASSIFICATION_ICONS[classification];
      expect(icon, `missing icon for ${classification}`).toBeTruthy();
      expect(icon.label.length).toBeGreaterThan(2);
      expect(icon.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(icon.fileName).toMatch(/\.png$/);
    }
  });

  it('maps exactly the ten gradeable classifications to the supplied slots', () => {
    expect(TEN_CLASSIFICATIONS).toHaveLength(10);
    const files = TEN_CLASSIFICATIONS.map((c) => CLASSIFICATION_ICONS[c].fileName);
    expect(new Set(files).size).toBe(10);
    // Brilliant, great, best, excellent, good, book, inaccuracy, mistake, blunder, miss.
    expect(TEN_CLASSIFICATIONS).toEqual([
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
    ]);
  });

  it('builds asset URLs under the deployment base path', () => {
    const url = iconAssetUrl('blunder.png');
    expect(url).toMatch(/\/assets\/analysis\/blunder\.png$/);
    expect(url.startsWith('/')).toBe(true);
  });

  it('uses the built-in glyphs when no icon files are supplied', async () => {
    const fetchImpl = (async () => ({ ok: false, headers: { get: () => null } })) as unknown as typeof fetch;
    const overrides = await loadIconOverrides(fetchImpl);
    expect(overrides).toEqual({});
  });

  it('prefers a supplied manifest when one exists', async () => {
    const responses: Record<string, unknown> = {
      'manifest.json': {
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ brilliant: 'my-brilliant.png', nonsense: 'x.png' }),
      },
    };
    const fetchImpl = (async (url: string) => {
      const key = url.split('/').pop()!;
      return responses[key] ?? { ok: false, headers: { get: () => null } };
    }) as unknown as typeof fetch;
    const overrides = await loadIconOverrides(fetchImpl);
    expect(overrides.brilliant).toMatch(/assets\/analysis\/my-brilliant\.png$/);
    expect(Object.keys(overrides)).toHaveLength(1);
  });

  it('detects individually dropped files without a manifest', async () => {
    const fetchImpl = (async (url: string) => {
      if (url.endsWith('manifest.json')) return { ok: false, headers: { get: () => null } };
      if (url.endsWith('blunder.png')) {
        return { ok: true, headers: { get: () => 'image/png' } };
      }
      return { ok: false, headers: { get: () => null } };
    }) as unknown as typeof fetch;
    const overrides = await loadIconOverrides(fetchImpl);
    expect(Object.keys(overrides)).toEqual(['blunder']);
  });
});
