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
| Built-in Stockfish (lite / stub + random-legal fallback) | Working |
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

Select **Stockfish (Built-in)** in AI Opponents. The app ships a lightweight UCI worker stub under `public/engines/`. For stronger play, replace it with the official **stockfish.js** lite single-threaded build from nmrugg/stockfish.js / npm `stockfish`.

Even without the full WASM, the adapter falls back to a **legal random move**, so the board always remains playable.

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

1. Open https://github.com/ziyyhhk/AIChess
2. **Settings → Pages**
3. Under **Build and deployment**, set **Source** to **GitHub Actions**
4. Save if prompted
5. Open the **Actions** tab and wait for the **Deploy to GitHub Pages** workflow
6. Visit **https://ziyyhhk.github.io/AIChess/**

Vite is configured with `base: '/AIChess/'`.

## License

MIT
