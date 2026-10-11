# Optional analysis icon set

AIChess draws its own original vector glyphs for the ten move classifications, so
the analysis view needs no external files. If you own an icon set you would
rather use, drop the images in this folder and AIChess will pick them up
automatically (it probes for these file names, and falls back to the built-in
glyph when a file is missing).

| Classification | File name        | Meaning in AIChess |
|----------------|------------------|--------------------|
| Brilliant      | `brilliant.png`  | The engine's best move that offers material and still wins |
| Great          | `great.png`      | The engine's best move in a position where one move is clearly stronger than the rest |
| Best           | `best.png`       | Matches (or keeps) the engine's evaluation |
| Excellent      | `excellent.png`  | Loses almost nothing (<= 0.35 pawns) |
| Good           | `good.png`       | Sound move with a small practical loss (<= 0.80 pawns) |
| Book           | `book.png`       | A known opening move that the engine also chooses |
| Inaccuracy     | `inaccuracy.png` | Noticeable but limited loss (<= 1.60 pawns) |
| Mistake        | `mistake.png`    | Substantial loss (<= 3.20 pawns) |
| Blunder        | `blunder.png`    | Major loss of evaluation, or a thrown-away forced mate |
| Miss           | `miss.png`       | A winning chance (or a forced mate) that was not taken |

Notes

- Transparency and aspect ratio are preserved: the images are rendered at 16-18 px
  with `object-fit: contain`, and every classification is *also* labelled with text,
  so the icons are never the only signal.
- Instead of the exact file names above you can ship a `manifest.json` in this
  folder that maps classifications to your own file names, for example:

  ```json
  {
    "brilliant": "my-brilliant.png",
    "blunder": "my-blunder.png"
  }
  ```

  Keys must be classification ids (the ones in the table above, lower case).

## About the Chess.com icons

The ten icons that were requested as Chess.com CDN URLs could **not** be
downloaded in the environment this was built in - `images.chesscomfiles.com` is
not reachable from it - so they were never inspected, and they are not
redistributed here. Those images belong to their owner and their licence for
redistribution has not been verified. Downloading them yourself and placing them
in this folder is a local, personal choice; the repository does not claim any
right to them.
