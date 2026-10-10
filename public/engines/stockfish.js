/* Minimal UCI-compatible stub. Replace with real stockfish lite single-threaded for strength. */
self.onmessage = function (e) {
  var msg = e.data;
  if (typeof msg !== 'string') return;
  if (msg === 'uci') {
    self.postMessage('id name Stockfish-Lite-Stub');
    self.postMessage('id author AIChess');
    self.postMessage('uciok');
    return;
  }
  if (msg === 'isready') {
    self.postMessage('readyok');
    return;
  }
  if (msg === 'ucinewgame') return;
  if (msg.indexOf('position') === 0) return;
  if (msg.indexOf('go') === 0) {
    setTimeout(function () {
      self.postMessage('bestmove (none)');
    }, 80);
  }
};
