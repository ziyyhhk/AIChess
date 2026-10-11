# AIChess repair — final report

Branch `arena/a798b339-aichess` → PR [#1](https://github.com/ziyyhhk/AIChess/pull/1).
Everything below was run in this checkout; anything that could not be run is
marked as such instead of being claimed.

| Check | Command | Result |
|---|---|---|
| Types | `npx tsc -b --pretty false` | clean, 0 errors |
| Lint | `npm run lint` | clean, 0 errors / 0 warnings (oxlint 1.87 added to devDependencies so the script works) |
| Tests | `npm test` | **208 tests in 21 files pass** |
| Build | `npm run build` | succeeds (`dist/`, 372 kB JS / 23 kB CSS) |
| Production site | `docs/` regenerated from `dist`, `.nojekyll` present | asset paths verified under `/AIChess/` |
| Real browser | — | **not run**: no browser exists in the build environment and none can be installed there (see §9). `anim-check.html` is provided so this can be confirmed in your own browser in seconds. |

---

## 1. Root causes of the reported failures

**No sound on ordinary moves (especially pawn moves).** Two bugs stacked.
`SOUND_FILES` pointed at `public/sounds/*.wav`, but `public/sounds/` **did not
exist** in the repository, so every bundled URL 404'd. The manager only recovered
by rewriting `element.src` from an `onerror` handler and never re-played the
event, so the **first** `play()` of every sound id was always swallowed — exactly
the "sometimes it is silent" symptom. On top of that the sound was selected by
piece type, and pawns had no entry of their own. Fixed by bundling real audio
(§2) and by choosing the sound from the move's *actor + metadata*.

**Pieces teleported.** The old board swapped a piece from one square to another in
the same commit; there was no travel of any kind, and the CSS `transition` that
existed could never fire because the element was a *different* element after the
re-render. Fixed by animating an explicit overlay piece along a computed path (§3).

**Instant "AI" replies.** Stockfish was launched with `go depth N`, which returns
in a few milliseconds at low levels, so the reply appeared immediately.

**Analysis was a placeholder tab** ("Future" in the README), the History view said
"saved games will appear here", and the ten classification icons were never
integrated.

## 2. Sounds

- 18 original WAV files are now shipped in `public/sounds/` (44.1 kHz mono,
  30 ms–1.4 s, generated deterministically by `scripts/generate-sounds.mjs`, so
  the repository carries no third-party audio and hot-links nothing).
- Every sound is triggered from **one** place: `commitMove()` in `src/App.tsx`,
  the single function that applies a move to the rules engine. No click handler,
  no render, no animation callback plays a move sound.
- The sound is chosen from the move's metadata and who moved it
  (`planMoveSounds`): checkmate > draw > check > capture > castle > promotion >
  ordinary move ⇒ `moveSelf.wav` / `moveOpponent.wav`. A **pawn move therefore
  sounds exactly like a knight move**, which was the specific complaint.
- Duplicates are impossible by construction: each committed move carries a
  dedupe key (`fenBefore + from/to/promotion`), and a repeat of the same key
  within 1.5 s is dropped — that covers re-renders, StrictMode double effects,
  flips, highlight changes, undo and history loads.
- A play that the element rejects (not decoded yet) sets a retry flag and is
  retried on `canplaythrough`; events fired before the first user gesture are
  queued and flushed by `unlock()` (autoplay policy).
- Missing files, mute, and volume are all handled: a failed asset warns once and
  falls back to the bundled file, `enabled=false` short-circuits, and volume is
  applied to every element and persisted.
- The illegal sound plays **only** for a destination the rules engine actually
  rejected. Selecting another friendly piece, queueing a premove, an engine
  failure or a network error never triggers it.

## 3. Piece animation

A committed move produces one `FlightRequest` (id, from, to, colour, piece,
castle flag, drop point). `ChessBoard` converts it into flights
(`src/components/board/flights.ts`) inside a **layout effect**, hides the
destination square and renders the real piece image in an overlay one square wide,
positioned with `translate3d(x*100%, y*100%, 0)`. One square of travel is exactly
100 % of the piece's own width at every board size, after a resize and after a
flip — no pixel measuring, no second move execution.

Covered: human moves, AI moves, premoves (they wait for the opponent's flight to
settle), captures, en passant, castling (king **and** rook fly separately),
promotion (the pawn travels, then becomes its piece), drag-and-drop (the flight
starts where the piece was released), rapid move sequences (flights are capped and
settled, never leaked), undo/restart (flights cleared), board flip and resize.
`prefers-reduced-motion` and the "Slide animation" setting skip travel entirely.

Evidence in `src/__tests__/boardAnimation.test.tsx`: the recorded Web Animations
keyframes start on the source square and end on the destination square
(e2→e4 = `translate3d(400%,600%,0)` → `translate3d(400%,400%,0)`, 200 ms), the
destination square is empty while the piece is in the air, and the arrival fires
`onAnimationSettled` exactly once. What is *not* proven here is the rendered
pixels of a real browser (see §9).

## 4. AI thinking time and premoves

```
displayed wait = max(engine response time, target)
```
The engine starts immediately; only the *display* of an already-computed move is
delayed, so a slow engine is never delayed further. Settings → **AI thinking
time**: `Instant`, `Natural` (Beginner 0.7–1.2 s, Easy 0.8–1.5 s, Medium 1.0–2.0 s,
Hard 1.2–2.7 s, Expert 1.5–3.5 s, slightly randomised inside the range) or a
custom slider. The panel shows "… is thinking" and the player bar shows
`Thinking`. Requests are de-duplicated by a `requestingRef` guard and every reply
is discarded if the position has moved on. An engine or network failure shows an
error and a notification sound — never an illegal move, never a checkmate.

Premoves: while the opponent thinks, clicking or dragging stores a premove
(highlighted, one `premove.wav`), never touching the position. After the reply —
and after its animation settles — it is re-validated against the new position and
either played normally or discarded silently. A discarded premove does not play
the illegal sound.

## 5. Game analysis

`Analysis` in the sidebar, or **Analyse game** in the game panel. Real, not a
placeholder: the current move history is snapshotted (the live game is never
touched), every position is rebuilt from the real moves and evaluated with a
**dedicated engine worker** — a second worker, so analysis can never interrupt the
engine that is playing. The UI shows `Analysing move 18 of 42` with a progress
bar, supports **cancellation** (partial results are kept, the summary is marked
aborted) and **retry**, and reports failures instead of inventing numbers. MultiPV 2
on the position before each move gives a genuine second-best line, which is what
makes "critical position" a measured fact. Selecting a move shows that position on
a separate review board, clearly labelled as not the live game, with a button back
to the live board. When no engine can be loaded, a small original built-in search
(`src/engine/miniEngine.ts`) is used and the banner says so.

## 6. Classification, accuracy and icons

Every grade is AIChess's own heuristic over real engine numbers, with all
thresholds in one documented place (`src/analysis/classification.ts`,
`DEFAULT_THRESHOLDS`): forced → book (local book **and** the engine agrees) →
brilliant (engine's move, offers ≥ 1.00 that can actually be captured, still
≥ +1.00) → great (≥ 1.50 gap to the second-best) → best (≤ 0.12 loss) →
excellent (≤ 0.35) → good (≤ 0.80) → inaccuracy (≤ 1.60) → mistake (≤ 3.20) →
blunder, with `miss` for a let-slip forced mate or winning position. Mate scores
are handled separately (`mate 0` = the side to move is mated). Accuracy is
defined in code (`100·e^(-loss/400)`, averaged, book and forced excluded) and
labelled in the UI as AIChess's own estimate — it is not presented as anyone
else's number.

Icons: the ten Chess.com PNG URLs **could not be fetched** in the build
environment (that host is unreachable from it), so the files were never seen or
mapped, and they are not redistributed — no licence claim is made. Original vector
glyphs ship by default (no emoji, no letter soup), each classification always also
carries a text label, and any icon set (including those ten files, if you have the
right to use them) can be dropped into `public/assets/analysis/` — the app probes
that folder at runtime and uses whatever is there, under the Pages base path.

## 7. PGN

Real current game, rendered by chess.js (correct SAN, captures, castling, en
passant, promotion, check/mate), with `Event`, `Site`, `Date`, `Round`, `White`,
`Black`, `Result` headers and the right token (`1-0`, `0-1`, `1/2-1/2`, `*`).
**Copy PGN** reports success only after a real clipboard write, falls back to
`execCommand`, and if both fail it shows the PGN in a read-only, selectable field
instead of pretending it copied. **Download PGN** writes
`aichess-game-YYYY-MM-DD.pgn`. Restarting clears everything: the tests re-parse
the exported PGN and assert the undone/unplayed moves are absent. The new
**History** view archives the last 40 finished or abandoned games in the browser
and can re-export any of them.

## 8. UI

Kept the existing dark, restrained interface (one accent colour, no gradients,
glass or emoji). The board is green-and-cream by default with three alternatives
and two piece sets. Every visible control works, including the two former
placeholders: History now lists real archived games, and About documents the real
behaviour. New: analysis view, premove chip, thinking indicator, copy fallback,
keyboard focus outlines, and responsive rules for 1080 px / 720 px.

## 9. Tests — and what was *not* tested

208 tests in 21 files, all passing: sound selection by actor/category, the
bundled WAV files themselves (real RIFF headers, non-silent), sound-manager
dedupe/rate-limit/fallback/unlock, selection and premove intent (including "own
piece → own piece is a selection change, never an illegal sound"), flight
geometry, DOM-level animation, UCI parsing, thinking time, classification
thresholds and mate handling, the analysis run (progress, cancellation, the live
game untouched), PGN completeness and round-trip, the history archive, icon
manifest handling, and an end-to-end App test that selects a pawn, moves it,
checks the sound and the overlay piece, queues and plays a premove, copies the
PGN, exercises the copy fallback and runs a full analysis.

**Not tested here:** a real browser. The build environment has no browser and
cannot install one (no system GTK/NSS stack, and the browser-download hosts are
blocked by the sandbox network policy), so no pixel-level or console-level run was
performed. To keep that verifiable, `anim-check.html` (dev only — never part of
`npm run build`) replays real moves through the real board and prints
`getBoundingClientRect()` of the flying piece on every animation frame with a
PASS/FAIL per move: open `/AIChess/anim-check.html` on the dev server and the
table appears in a few seconds. The same environment limitation means the jsDelivr
Stockfish build could not be smoke-tested here; the browser-side loader is the one
the deployed site already used.

## 10. Files and commits

Branch `arena/a798b339-aichess`, PR [#1](https://github.com/ziyyhhk/AIChess/pull/1).

New: `src/audio/soundCatalog.ts`, `src/chess/moveEvents.ts`, `src/chess/clickIntent.ts`,
`src/chess/pgn.ts`, `src/chess/pgnExport.ts`, `src/chess/pieces.ts`,
`src/components/board/flights.ts`, `src/components/FlyingPiece.tsx`,
`src/components/AnalysisView.tsx`, `src/components/analysis/{MoveGlyph,EvalGraph}.tsx`,
`src/components/HistoryView.tsx`, `src/analysis/*`, `src/engine/{stockfishLoader,uci,miniEngine}.ts`,
`src/history/archive.ts`, `src/ai/thinkTime.ts`, `scripts/generate-sounds.mjs`,
`public/sounds/*.wav`, `public/assets/analysis/`, `anim-check.html`, 21 test files,
regenerated `docs/`, updated `README.md`, `.github/workflows/ci.yml` (now runs
typecheck + lint + tests + build).

Rewritten/updated: `src/App.tsx` (single move pipeline, animation requests,
analysis orchestration), `src/components/{ChessBoard,GamePanel,SettingsPanel}.tsx`,
`src/audio/soundManager.ts`, `src/chess/{gameController,premoveManager}.ts`,
`src/ai/{aiManager,types}.ts`, `src/styles/{board,global}.css`, `vite.config.ts`
(preview/dev host + allowed hosts), `index.html` (base-path-safe favicon).

Deployment is unchanged in kind: GitHub Pages still publishes the `docs/` folder of
`main` (verified through the API: legacy build, branch `main`, folder `/docs`,
`https://ziyyhhk.github.io/AIChess/`). `docs/` was rebuilt from `dist` with the new
hashed bundles, the sounds and the analysis assets, and the workflow that
regenerates it on push to `main` is untouched.
