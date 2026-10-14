import { describe, expect, it } from 'vitest';
import {
  BOTS,
  BOTS_BY_ELO,
  STRENGTH_ANCHORS,
  botEngineProfile,
  botPaceDifficulty,
  getBot,
  strengthForElo,
} from '../ai/bots';
import { buildGoCommand, DIFFICULTY_ORDER } from '../ai/providers/stockfishAdapter';
import { THINK_RANGES } from '../ai/thinkTime';
import { DEFAULT_SETTINGS } from '../ai/types';

describe('bot roster', () => {
  it('ships exactly 50 bots with unique ids and names', () => {
    expect(BOTS.length).toBe(50);
    expect(new Set(BOTS.map((b) => b.id)).size).toBe(50);
    expect(new Set(BOTS.map((b) => b.name)).size).toBe(50);
  });

  it('gives every bot a whole-number ELO inside the supported range and a country', () => {
    for (const bot of BOTS) {
      expect(Number.isInteger(bot.elo)).toBe(true);
      expect(bot.elo).toBeGreaterThanOrEqual(400);
      expect(bot.elo).toBeLessThanOrEqual(2800);
      expect(bot.country.trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps ids URL- and storage-safe', () => {
    for (const bot of BOTS) {
      expect(bot.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('finds a bot by id and returns null for unknown or empty ids', () => {
    expect(getBot('mittens')?.name).toBe('Mittens');
    expect(getBot('not-a-bot')).toBeNull();
    expect(getBot(null)).toBeNull();
    expect(getBot('')).toBeNull();
  });

  it('sorts the picker list from weakest to strongest', () => {
    expect(BOTS_BY_ELO.length).toBe(BOTS.length);
    for (let i = 1; i < BOTS_BY_ELO.length; i++) {
      expect(BOTS_BY_ELO[i].elo).toBeGreaterThanOrEqual(BOTS_BY_ELO[i - 1].elo);
    }
  });

  it('starts with no bot selected', () => {
    expect(DEFAULT_SETTINGS.botId).toBeNull();
    expect(DEFAULT_SETTINGS.humanRating).toBeNull();
  });
});

describe('strength mapping', () => {
  it('has anchors in ascending ELO order with valid engine values', () => {
    for (let i = 0; i < STRENGTH_ANCHORS.length; i++) {
      const a = STRENGTH_ANCHORS[i];
      expect(a.skill).toBeGreaterThanOrEqual(0);
      expect(a.skill).toBeLessThanOrEqual(20);
      expect(a.depth).toBeGreaterThanOrEqual(1);
      expect(a.movetimeMs).toBeGreaterThan(0);
      expect(a.randomMoveChance).toBeGreaterThanOrEqual(0);
      expect(a.randomMoveChance).toBeLessThanOrEqual(1);
      if (i > 0) expect(a.elo).toBeGreaterThan(STRENGTH_ANCHORS[i - 1].elo);
    }
  });

  it('returns the anchor values exactly at each anchor ELO', () => {
    for (const a of STRENGTH_ANCHORS) {
      const s = strengthForElo(a.elo);
      expect(s.skill).toBe(a.skill);
      expect(s.depth).toBe(a.depth);
      expect(s.movetimeMs).toBe(a.movetimeMs);
      expect(s.randomMoveChance).toBeCloseTo(a.randomMoveChance, 10);
    }
  });

  it('never makes a stronger ELO weaker, across the whole range', () => {
    let prev = strengthForElo(300);
    for (let elo = 325; elo <= 3000; elo += 25) {
      const cur = strengthForElo(elo);
      expect(cur.skill).toBeGreaterThanOrEqual(prev.skill);
      expect(cur.depth).toBeGreaterThanOrEqual(prev.depth);
      expect(cur.movetimeMs).toBeGreaterThanOrEqual(prev.movetimeMs);
      expect(cur.randomMoveChance).toBeLessThanOrEqual(prev.randomMoveChance + 1e-12);
      expect(cur.weakerLineChance).toBeLessThanOrEqual(prev.weakerLineChance + 1e-12);
      prev = cur;
    }
  });

  it('clamps out-of-range and invalid ELO values to the nearest anchor', () => {
    expect(strengthForElo(10)).toEqual(strengthForElo(400));
    expect(strengthForElo(9999)).toEqual(strengthForElo(2800));
    expect(strengthForElo(Number.NaN)).toEqual(strengthForElo(400));
  });

  it('gives every bot an engine profile that never uses UCI_LimitStrength', () => {
    for (const bot of BOTS) {
      const p = botEngineProfile(bot);
      expect(p.limitStrength).toBe(false);
      expect(p.targetRating).toBe(bot.elo);
      expect(p.depth).toBeGreaterThanOrEqual(1);
    }
  });

  it('orders the bots so each stronger bot has an engine profile at least as strong', () => {
    for (let i = 1; i < BOTS_BY_ELO.length; i++) {
      const weaker = botEngineProfile(BOTS_BY_ELO[i - 1]);
      const stronger = botEngineProfile(BOTS_BY_ELO[i]);
      expect(stronger.skill).toBeGreaterThanOrEqual(weaker.skill);
      expect(stronger.depth).toBeGreaterThanOrEqual(weaker.depth);
      expect(stronger.randomMoveChance).toBeLessThanOrEqual(weaker.randomMoveChance + 1e-12);
    }
  });

  it('gives the weakest bot deliberate mistakes and the strongest almost none', () => {
    const weakest = botEngineProfile(BOTS_BY_ELO[0]);
    const strongest = botEngineProfile(BOTS_BY_ELO[BOTS_BY_ELO.length - 1]);
    expect(weakest.randomMoveChance).toBeGreaterThan(0.2);
    expect(strongest.randomMoveChance).toBe(0);
  });
});

describe('thinking-time pacing for bots', () => {
  it('maps every bot to a difficulty whose thinking range exists', () => {
    for (const bot of BOTS) {
      expect(THINK_RANGES[botPaceDifficulty(bot.elo)]).toBeDefined();
    }
  });

  it('never moves to a slower-paced bucket as the ELO rises', () => {
    let last = -1;
    for (const bot of BOTS_BY_ELO) {
      const index = DIFFICULTY_ORDER.indexOf(botPaceDifficulty(bot.elo));
      expect(index).toBeGreaterThanOrEqual(last);
      last = index;
    }
  });

  it('uses the expected buckets at representative ratings', () => {
    expect(botPaceDifficulty(455)).toBe('beginner');
    expect(botPaceDifficulty(1262)).toBe('medium');
    expect(botPaceDifficulty(2750)).toBe('expert');
  });
});

describe('UCI go command', () => {
  it('keeps the movetime-only form when no depth is given', () => {
    expect(buildGoCommand(500)).toBe('go movetime 500');
  });

  it('adds a depth cap alongside the movetime cap', () => {
    expect(buildGoCommand(500, 8)).toBe('go depth 8 movetime 500');
  });

  it('clamps very small movetimes to the engine minimum', () => {
    expect(buildGoCommand(10)).toBe('go movetime 80');
  });
});
