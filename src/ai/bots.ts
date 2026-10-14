/**
 * Bot opponents: named Stockfish personas, each with a target ELO and a country.
 *
 * The ELO values are PLACEHOLDERS. They are the target each bot is configured
 * for, not a measured rating. Calibrate them against reference games before
 * presenting them as real strength (see the calibration notes in the README).
 *
 * A bot never changes the search algorithm. It only sets Stockfish's skill
 * level, a depth cap, a movetime cap and two deliberate-error chances, all
 * interpolated from the ELO through STRENGTH_ANCHORS below. AI thinking time
 * (the display pacing) is still chosen from the existing difficulty ranges via
 * botPaceDifficulty(), so pacing behaves the same as for the built-in levels.
 */
import type { DifficultyProfile, StockfishDifficulty } from './providers/stockfishAdapter';

export interface Bot {
  /** Stable identifier stored in settings. Never change once shipped. */
  id: string;
  name: string;
  /** Approximate target rating. Placeholder until calibrated. */
  elo: number;
  country: string;
}

export const BOTS: readonly Bot[] = [
  { id: 'mittens', name: 'Mittens', elo: 612, country: 'Japan' },
  { id: 'whiskers-mcgee', name: 'Whiskers McGee', elo: 748, country: 'Ireland' },
  { id: 'biscuit', name: 'Biscuit', elo: 455, country: 'Canada' },
  { id: 'sir-fluffington', name: 'Sir Fluffington', elo: 1034, country: 'United Kingdom' },
  { id: 'tater-tot', name: 'Tater Tot', elo: 521, country: 'United States' },
  { id: 'grandmaster-nugget', name: 'Grandmaster Nugget', elo: 1389, country: 'Germany' },
  { id: 'pawnzilla', name: 'Pawnzilla', elo: 905, country: 'Brazil' },
  { id: 'captain-crumble', name: 'Captain Crumble', elo: 1187, country: 'Australia' },
  { id: 'ms-sprinkles', name: 'Ms. Sprinkles', elo: 1262, country: 'Netherlands' },
  { id: 'bishop-biscuit', name: 'Bishop Biscuit', elo: 1455, country: 'Italy' },
  { id: 'rook-rascal', name: 'Rook Rascal', elo: 1601, country: 'Mexico' },
  { id: 'dr-pickles', name: 'Dr. Pickles', elo: 1738, country: 'Turkey' },
  { id: 'noodle-knight', name: 'Noodle Knight', elo: 1024, country: 'South Korea' },
  { id: 'gizmo', name: 'Gizmo', elo: 1895, country: 'Poland' },
  { id: 'lord-pudding', name: 'Lord Pudding', elo: 1140, country: 'Sweden' },
  { id: 'the-pigeon', name: 'The Pigeon', elo: 1376, country: 'Egypt' },
  { id: 'chonk', name: 'Chonk', elo: 705, country: 'Philippines' },
  { id: 'senor-waffles', name: 'Señor Waffles', elo: 1562, country: 'Spain' },
  { id: 'mochi', name: 'Mochi', elo: 1310, country: 'Japan' },
  { id: 'sergeant-sock', name: 'Sergeant Sock', elo: 938, country: 'Nigeria' },
  { id: 'dumpling-duke', name: 'Dumpling Duke', elo: 1820, country: 'China' },
  { id: 'nebula-knight', name: 'Nebula Knight', elo: 2067, country: 'Russia' },
  { id: 'kevin-the-cucumber', name: 'Kevin the Cucumber', elo: 634, country: 'India' },
  { id: 'frostbite', name: 'Frostbite', elo: 2149, country: 'Norway' },
  { id: 'oatmeal', name: 'Oatmeal', elo: 468, country: 'Argentina' },
  { id: 'count-crumpet', name: 'Count Crumpet', elo: 1510, country: 'Austria' },
  { id: 'velvet-hammer', name: 'Velvet Hammer', elo: 2310, country: 'France' },
  { id: 'quokka-queen', name: 'Quokka Queen', elo: 2388, country: 'Australia' },
  { id: 'thunder-toast', name: 'Thunder Toast', elo: 1703, country: 'Greece' },
  { id: 'hamster-mafia', name: 'Hamster Mafia', elo: 1085, country: 'Colombia' },
  { id: 'potato-prince', name: 'Potato Prince', elo: 1968, country: 'Hungary' },
  { id: 'lemon-lancer', name: 'Lemon Lancer', elo: 1219, country: 'Portugal' },
  { id: 'nacho-bishop', name: 'Nacho Bishop', elo: 1342, country: 'Chile' },
  { id: 'madame-mittens', name: 'Madame Mittens', elo: 2044, country: 'Belgium' },
  { id: 'bagel-baron', name: 'Bagel Baron', elo: 1496, country: 'Israel' },
  { id: 'spudnik', name: 'Spudnik', elo: 2214, country: 'Finland' },
  { id: 'glitter-gremlin', name: 'Glitter Gremlin', elo: 879, country: 'Peru' },
  { id: 'admiral-waffleton', name: 'Admiral Waffleton', elo: 2461, country: 'South Africa' },
  { id: 'mister-meatball', name: 'Mister Meatball', elo: 1653, country: 'Italy' },
  { id: 'stormcloud', name: 'Stormcloud', elo: 2530, country: 'Iceland' },
  { id: 'ferdinand-the-ferret', name: 'Ferdinand the Ferret', elo: 772, country: 'New Zealand' },
  { id: 'cinnamon-kid', name: 'Cinnamon Kid', elo: 1120, country: 'Vietnam' },
  { id: 'crumbs', name: 'Crumbs', elo: 547, country: 'Kenya' },
  { id: 'grand-duchess-pudge', name: 'Grand Duchess Pudge', elo: 2296, country: 'Ukraine' },
  { id: 'pancake-phantom', name: 'Pancake Phantom', elo: 1785, country: 'Canada' },
  { id: 'old-man-gravy', name: 'Old Man Gravy', elo: 2600, country: 'Ireland' },
  { id: 'tofu-tyrant', name: 'Tofu Tyrant', elo: 1441, country: 'Thailand' },
  { id: 'lasagna-lord', name: 'Lasagna Lord', elo: 2008, country: 'Morocco' },
  { id: 'sir-tater-of-apple-sauce', name: 'Sir Tater of Apple Sauce', elo: 2750, country: 'Kazakhstan' },
  { id: 'sir-cheddar-ironbeak', name: 'Sir Cheddar Ironbeak', elo: 2412, country: 'Switzerland' },
];

const BOT_BY_ID = new Map(BOTS.map((b) => [b.id, b] as const));

/** Bots sorted from weakest to strongest. Stable for equal ratings. */
export const BOTS_BY_ELO: readonly Bot[] = [...BOTS].sort((a, b) => a.elo - b.elo);

export function getBot(id: string | null | undefined): Bot | null {
  if (!id) return null;
  return BOT_BY_ID.get(id) ?? null;
}

/**
 * Engine settings at fixed ELO anchors. Values between two anchors are
 * linearly interpolated. These numbers are approximate and must be calibrated.
 * Stockfish 10 (the CDN build in use) has no UCI_Elo option, so strength comes
 * from skill level, depth and movetime caps plus the deliberate-error chances.
 */
export const STRENGTH_ANCHORS = [
  { elo: 400, skill: 0, depth: 1, movetimeMs: 300, randomMoveChance: 0.45, weakerLineChance: 0.4 },
  { elo: 800, skill: 2, depth: 2, movetimeMs: 400, randomMoveChance: 0.25, weakerLineChance: 0.3 },
  { elo: 1200, skill: 6, depth: 4, movetimeMs: 700, randomMoveChance: 0.1, weakerLineChance: 0.18 },
  { elo: 1600, skill: 10, depth: 7, movetimeMs: 1000, randomMoveChance: 0.03, weakerLineChance: 0.08 },
  { elo: 2000, skill: 14, depth: 10, movetimeMs: 1400, randomMoveChance: 0, weakerLineChance: 0.02 },
  { elo: 2400, skill: 18, depth: 12, movetimeMs: 1800, randomMoveChance: 0, weakerLineChance: 0 },
  { elo: 2800, skill: 20, depth: 14, movetimeMs: 2200, randomMoveChance: 0, weakerLineChance: 0 },
] as const;

export interface StrengthSettings {
  skill: number;
  depth: number;
  movetimeMs: number;
  randomMoveChance: number;
  weakerLineChance: number;
}

/** Engine settings for a target ELO, clamped to the anchor range. */
export function strengthForElo(elo: number): StrengthSettings {
  const first = STRENGTH_ANCHORS[0];
  const last = STRENGTH_ANCHORS[STRENGTH_ANCHORS.length - 1];
  if (!Number.isFinite(elo) || elo <= first.elo) {
    return {
      skill: first.skill,
      depth: first.depth,
      movetimeMs: first.movetimeMs,
      randomMoveChance: first.randomMoveChance,
      weakerLineChance: first.weakerLineChance,
    };
  }
  if (elo >= last.elo) {
    return {
      skill: last.skill,
      depth: last.depth,
      movetimeMs: last.movetimeMs,
      randomMoveChance: last.randomMoveChance,
      weakerLineChance: last.weakerLineChance,
    };
  }
  let i = 0;
  while (i < STRENGTH_ANCHORS.length - 2 && elo > STRENGTH_ANCHORS[i + 1].elo) i++;
  const a = STRENGTH_ANCHORS[i];
  const b = STRENGTH_ANCHORS[i + 1];
  const t = (elo - a.elo) / (b.elo - a.elo);
  const lerp = (x: number, y: number) => x + (y - x) * t;
  return {
    skill: Math.round(lerp(a.skill, b.skill)),
    depth: Math.round(lerp(a.depth, b.depth)),
    movetimeMs: Math.round(lerp(a.movetimeMs, b.movetimeMs)),
    randomMoveChance: lerp(a.randomMoveChance, b.randomMoveChance),
    weakerLineChance: lerp(a.weakerLineChance, b.weakerLineChance),
  };
}

/** The adapter profile for a bot. Never uses UCI_LimitStrength. */
export function botEngineProfile(bot: Bot): DifficultyProfile {
  const s = strengthForElo(bot.elo);
  return {
    skill: s.skill,
    depth: s.depth,
    movetime: s.movetimeMs,
    limitStrength: false,
    randomMoveChance: s.randomMoveChance,
    weakerLineChance: s.weakerLineChance,
    targetRating: bot.elo,
  };
}

/**
 * Which existing difficulty's thinking-time range a bot uses. Keeping pacing on
 * the existing ranges means the bot work does not change how long replies take.
 */
export function botPaceDifficulty(elo: number): StockfishDifficulty {
  if (elo <= 700) return 'beginner';
  if (elo <= 1100) return 'easy';
  if (elo <= 1500) return 'medium';
  if (elo <= 1900) return 'hard';
  return 'expert';
}
