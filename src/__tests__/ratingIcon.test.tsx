import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RatingTierIcon } from '../ui/RatingTierIcon';
import { exportPgn } from '../chess/pgn';

const here = dirname(fileURLToPath(import.meta.url));
const source = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('RatingTierIcon', () => {
  it('renders the tier name and range as visible text when asked', () => {
    const html = renderToStaticMarkup(<RatingTierIcon rating={1300} showLabel />);
    expect(html).toContain('Bishop, 1200–1599');
    expect(html).toContain('aria-hidden="true"');
  });

  it('exposes an accessible name and a tooltip when the label is hidden', () => {
    const html = renderToStaticMarkup(<RatingTierIcon rating={2450} />);
    expect(html).toContain('aria-label="King, rating 2400 and up"');
    expect(html).toContain('title="King, 2400 and up"');
    expect(html).toContain('role="img"');
  });

  it('draws a different piece glyph for each tier', () => {
    const markup = [400, 1000, 1300, 1700, 2100, 2500].map((r) =>
      renderToStaticMarkup(<RatingTierIcon rating={r} />)
    );
    expect(new Set(markup).size).toBe(markup.length);
  });

  it('renders nothing when no rating is known', () => {
    expect(renderToStaticMarkup(<RatingTierIcon rating={null} />)).toBe('');
    expect(renderToStaticMarkup(<RatingTierIcon rating={undefined} showLabel />)).toBe('');
  });
});

describe('icon source', () => {
  it('references no external URLs or remote images', () => {
    for (const file of ['../ui/RatingTierIcon.tsx', '../ui/ratingTiers.ts', '../ai/bots.ts']) {
      const text = source(file);
      expect(text, file).not.toMatch(/https?:\/\//i);
      expect(text, file).not.toMatch(/url\(/i);
      expect(text, file).not.toMatch(/chesscomfiles|chess\.com/i);
    }
  });
});

describe('PGN rating headers', () => {
  const game = {
    getResult: () => null,
    isGameOver: () => false,
    getPgn: () => '1. e4 e5',
  } as unknown as Parameters<typeof exportPgn>[0];

  it('writes WhiteElo and BlackElo when ratings are known', () => {
    const pgn = exportPgn(game, { white: 'You', black: 'Mittens', whiteElo: 1450, blackElo: 612 });
    expect(pgn).toContain('[WhiteElo "1450"]');
    expect(pgn).toContain('[BlackElo "612"]');
  });

  it('omits the rating headers when a rating is not known', () => {
    const pgn = exportPgn(game, { white: 'You', black: 'Stockfish', whiteElo: null, blackElo: 612 });
    expect(pgn).not.toContain('WhiteElo');
    expect(pgn).toContain('[BlackElo "612"]');
  });
});
