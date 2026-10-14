/**
 * Builds the offline pool of generated mate-in-one puzzles.
 *
 * Random-game generation is too slow to run on a click in the browser, so the
 * pool is built ahead of time with fixed seeds and committed as data. Each seed
 * yields at most one puzzle, so the same arguments always give the same pool.
 *
 * Usage (run from the repo root):
 *   npx vite-node scripts/build-puzzle-pool.ts -- --from 1 --to 120 --out pool-a.json
 *
 * Partial outputs from several ranges are merged with --merge:
 *   npx vite-node scripts/build-puzzle-pool.ts -- --merge pool-a.json pool-b.json --out src/puzzles/generatedPool.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import {
  generateMateInOne,
  mulberry32,
  positionKey,
  ratingForFen,
} from '../src/puzzles/generator';
import { validatePuzzle } from '../src/puzzles/validate';
import type { PuzzleDef } from '../src/puzzles/catalog';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function mergeMode(files: string[], out: string): void {
  const seen = new Set<string>();
  const pool: PuzzleDef[] = [];
  for (const file of files) {
    for (const puzzle of JSON.parse(readFileSync(file, 'utf8')) as PuzzleDef[]) {
      const key = positionKey(puzzle.fen);
      if (seen.has(key) || !validatePuzzle(puzzle).ok) continue;
      seen.add(key);
      // Re-rate from the position, so the rating always follows the current formula.
      pool.push({ ...puzzle, rating: ratingForFen(puzzle.fen) });
    }
  }
  pool.sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(out, JSON.stringify(pool, null, 1) + '\n');
  console.log(`merged ${pool.length} puzzles into ${out}`);
}

function buildMode(from: number, to: number, out: string): void {
  const pool: PuzzleDef[] = [];
  const started = Date.now();
  for (let seed = from; seed <= to; seed++) {
    const puzzle = generateMateInOne({ rng: mulberry32(seed), maxGames: 400 });
    if (puzzle) pool.push(puzzle);
    if (seed % 10 === 0) console.log(`seed ${seed}: ${pool.length} puzzles, ${Math.round((Date.now() - started) / 1000)}s`);
  }
  writeFileSync(out, JSON.stringify(pool, null, 1) + '\n');
  console.log(`wrote ${pool.length} puzzles from seeds ${from}-${to} to ${out}`);
}

const mergeIdx = process.argv.indexOf('--merge');
if (mergeIdx >= 0) {
  const files = process.argv.slice(mergeIdx + 1).filter((a) => !a.startsWith('--'));
  mergeMode(files, arg('--out') ?? 'generatedPool.json');
} else {
  buildMode(Number(arg('--from') ?? 1), Number(arg('--to') ?? 10), arg('--out') ?? 'pool.json');
}
