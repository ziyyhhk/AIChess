# AIChess

A modern, playable chess website where you face **free and configurable AI models** (Google Gemini, OpenRouter free routes) plus a **built-in Stockfish** engine — all in the browser, deployable on GitHub Pages.

**Live (after you enable Pages):** `https://ziyyhhk.github.io/AIChess/`

## Features

| Feature | Status |
|--------|--------|
| Full chess rules (castling, en passant, promotion, draws) | Working |
| Drag / click / touch moves | Working |
| Premoves (queue while AI thinks) | Working |
| Right-click arrows & square highlights | Working |
| Move history (SAN) | Working |
| New game / takeback / flip / resign | Working |
| Built-in Stockfish (time-controlled search, loaded from CDN) | Working |
| Minimum AI thinking time (room to premove) | Working, set in Settings |
| Gemini API adapter | Working (your key) |
| OpenRouter free-route adapter | Working (your key) |
| API key settings (session memory) | Working |
| Responsive dark UI | Working |
| GitHub Pages deploy workflow | Configured |
| Full local game-history DB | Future |
| Deep analysis board | Future |

## Requirements

- Node.js **20+** (22 recommended)
- npm 10+

## Local development

```bash
git clone https://github.com/ziyyhhk/AIChess.git
cd AIChess
npm install --legacy-peer-deps
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173/AIChess/`).

```bash
npm run build    # production build → dist/
npm run preview  # preview the production build
npm test         # unit tests
```

## AI providers

### Stockfish (no key)

Select **Stockfish (Built-in)** in AI Opponents. The engine is `stockfish.js` 10.0.2, loaded at runtime from jsDelivr as a Web Worker. `public/engines/stockfish.js` is a placeholder. The app detects it and uses the CDN instead.

To host the engine yourself, put a full single-file `stockfish.js` build (over 5 KB) at `public/engines/stockfish.js`. Stockfish is GPL-licensed, so check that licence before you commit a copy to this MIT-licensed repository.

Each Stockfish move is a time-controlled search (`go movetime`). Depth is not a limit. The AI then waits at least the **Minimum thinking time** from Settings (default 1.2 s), so you can queue a premove.

### Google Gemini (your API key)

1. Create a key in Google AI Studio.
2. Open **Settings** in AIChess → paste the key → Save.
3. Choose a Gemini model under **AI Opponents**.

### OpenRouter (your API key)

1. Create a key at openrouter.ai.
2. Save it in Settings.
3. Pick any curated `:free` model in the opponent list.

Free routes are **rate-limited**. Model availability changes.

### Security

- This is a **static** site. Anything shipped in the JS bundle is public.
- **Never** commit API keys.
- Keys are held in memory for the browser session.

## GitHub Pages deployment

The workflow in `.github/workflows/deploy.yml` publishes the site with the GitHub Pages Actions flow. **Source must be GitHub Actions.** Do not choose "Deploy from a branch", and do not pick the `docs` folder as the source.

1. Open your repository on GitHub, then **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to `main`, or open the **Actions** tab and run **Deploy to GitHub Pages** manually.
4. When the run is green, open `https://<your-user>.github.io/AIChess/`.

The workflow also regenerates `docs/` from each build. That folder is generated, so edit `src/` and let the workflow refresh it.

Vite is configured with `base: '/AIChess/'`, so the repository name must stay `AIChess`. If you rename the repository, change `base` in `vite.config.ts` to match.

## License

MIT
