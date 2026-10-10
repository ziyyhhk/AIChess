/* Placeholder: AIChess loads the real Stockfish engine from CDN
   (cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js) as a blob Worker
   so GitHub Pages subpath deploys work without hosting a 1.6MB binary here.

   To use a local engine instead, replace this file with a full stockfish.js
   build larger than 5KB (not a stub that returns bestmove (none)).
*/
self.onmessage = function () {
  self.postMessage('id name Stockfish-Placeholder');
  self.postMessage('uciok');
};
