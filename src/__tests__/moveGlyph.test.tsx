// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MoveGlyph } from '../components/analysis/MoveGlyph';
import { CLASSIFICATIONS } from '../analysis/classification';
import { CLASSIFICATION_ICONS } from '../analysis/iconAssets';

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function render(element: React.ReactElement): HTMLDivElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return container;
}

describe('MoveGlyph', () => {
  it('draws an accessible vector glyph for every classification', () => {
    for (const classification of CLASSIFICATIONS) {
      const container = render(<MoveGlyph classification={classification} />);
      const svg = container.querySelector('svg');
      expect(svg, `${classification} should render an svg`).not.toBeNull();
      expect(svg!.getAttribute('aria-label')).toBe(CLASSIFICATION_ICONS[classification].label);
      expect(svg!.getAttribute('data-classification')).toBe(classification);
      // No emoji: the glyph is vector shapes only.
      expect(container.textContent).toBe('');
      expect(svg!.querySelectorAll('path, circle').length).toBeGreaterThan(0);
      container.remove();
    }
  });

  it('uses a supplied image when one is available', () => {
    const container = render(
      <MoveGlyph classification="blunder" overrides={{ blunder: '/AIChess/assets/analysis/blunder.png' }} />
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/AIChess/assets/analysis/blunder.png');
    expect(img?.getAttribute('alt')).toBe('Blunder');
    expect(container.querySelector('svg')).toBeNull();
    container.remove();
  });

  it('keeps the same footprint whatever icon is used', () => {
    const container = render(<MoveGlyph classification="best" size={22} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('22');
    expect(svg.getAttribute('height')).toBe('22');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    container.remove();
  });
});
