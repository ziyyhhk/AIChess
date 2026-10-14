import { describe, expect, it } from 'vitest';
import {
  RATING_TIERS,
  formatTierRange,
  parseRatingHeader,
  tierForRating,
} from '../ui/ratingTiers';
import { ratingsForGame } from '../ai/opponentRatings';
import { BOTS, getBot } from '../ai/bots';
import { difficultyToSettings } from '../ai/providers/stockfishAdapter';

describe('rating tier config', () => {
  it('has six piece tiers in order, with no gaps or overlaps', () => {
    expect(RATING_TIERS.map((t) => t.id)).toEqual([
      'pawn',
      'knight',
      'bishop',
      'rook',
      'queen',
      'king',
    ]);
    expect(RATING_TIERS[0].minRating).toBe(0);
    expect(RATING_TIERS[RATING_TIERS.length - 1].maxRating).toBeNull();
    for (let i = 1; i < RATING_TIERS.length; i++) {
      expect(RATING_TIERS[i].minRating).toBe((RATING_TIERS[i - 1].maxRating as number) + 1);
    }
  });

  it('gives each tier a distinct accent colour', () => {
    expect(new Set(RATING_TIERS.map((t) => t.color)).size).toBe(RATING_TIERS.length);
  });
});

describe('tierForRating', () => {
  it.each([
    [0, 'pawn'],
    [799, 'pawn'],
    [800, 'knight'],
    [1199, 'knight'],
    [1200, 'bishop'],
    [1599, 'bishop'],
    [1600, 'rook'],
    [1999, 'rook'],
    [2000, 'queen'],
    [2399, 'queen'],
    [2400, 'king'],
    [3200, 'king'],
  ])('puts %i in the %s tier', (rating, id) => {
    expect(tierForRating(rating)?.id).toBe(id);
  });

  it('returns null when there is no usable rating', () => {
    expect(tierForRating(null)).toBeNull();
    expect(tierForRating(undefined)).toBeNull();
    expect(tierForRating(Number.NaN)).toBeNull();
    expect(tierForRating(-5)).toBeNull();
  });
});

describe('formatTierRange', () => {
  it('reads naturally at both open ends', () => {
    expect(formatTierRange(RATING_TIERS[0])).toBe('under 800');
    expect(formatTierRange(RATING_TIERS[1])).toBe('800–1199');
    expect(formatTierRange(RATING_TIERS[5])).toBe('2400 and up');
  });
});

describe('parseRatingHeader', () => {
  it('reads plain ratings from PGN headers', () => {
    expect(parseRatingHeader('1500')).toBe(1500);
    expect(parseRatingHeader(' 1287 ')).toBe(1287);
  });

  it('ignores missing and placeholder values', () => {
    expect(parseRatingHeader(undefined)).toBeNull();
    expect(parseRatingHeader(null)).toBeNull();
    expect(parseRatingHeader('')).toBeNull();
    expect(parseRatingHeader('?')).toBeNull();
    expect(parseRatingHeader('0')).toBeNull();
    expect(parseRatingHeader('4500')).toBeNull();
  });
});

describe('ratingsForGame', () => {
  const bot = getBot('mittens');
  const mittensElo = bot?.elo ?? 0;

  it('uses the entered rating for the player and the bot ELO for the bot', () => {
    expect(
      ratingsForGame({ playerColor: 'w', humanRating: 1450, bot, engineOpponent: true, difficulty: 'medium' })
    ).toEqual({ white: 1450, black: mittensElo });
  });

  it('swaps sides when the player is Black', () => {
    expect(
      ratingsForGame({ playerColor: 'b', humanRating: 1450, bot, engineOpponent: true, difficulty: 'medium' })
    ).toEqual({ white: mittensElo, black: 1450 });
  });

  it('shows no icon for the player until a rating is entered', () => {
    const r = ratingsForGame({ playerColor: 'w', humanRating: null, bot, engineOpponent: true, difficulty: 'medium' });
    expect(r.white).toBeNull();
    expect(r.black).toBe(mittensElo);
  });

  it('uses the level target rating when no bot is chosen', () => {
    const r = ratingsForGame({ playerColor: 'w', humanRating: null, bot: null, engineOpponent: true, difficulty: 'medium' });
    expect(r.black).toBe(difficultyToSettings('medium').targetRating);
  });

  it('gives hosted AI models no rating, so no icon', () => {
    const r = ratingsForGame({ playerColor: 'w', humanRating: 1200, bot: null, engineOpponent: false, difficulty: 'medium' });
    expect(r).toEqual({ white: 1200, black: null });
  });

  it('every bot resolves to a tier', () => {
    for (const b of BOTS) {
      expect(tierForRating(b.elo)).not.toBeNull();
    }
  });
});
