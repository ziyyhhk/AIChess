import { Chess, type Square, type Move } from 'chess.js';

export type { Square, Move };

export class GameController {
  private chess: Chess;
  private history: string[] = [];
  private lastMove: { from: Square; to: Square } | null = null;

  constructor(fen?: string) {
    this.chess = new Chess(fen);
  }

  getFen(): string {
    return this.chess.fen();
  }

  getTurn(): 'w' | 'b' {
    return this.chess.turn();
  }

  isGameOver(): boolean {
    return this.chess.isGameOver();
  }

  isCheck(): boolean {
    return this.chess.isCheck();
  }

  isCheckmate(): boolean {
    return this.chess.isCheckmate();
  }

  isStalemate(): boolean {
    return this.chess.isStalemate();
  }

  isDraw(): boolean {
    return this.chess.isDraw();
  }

  isInsufficientMaterial(): boolean {
    return this.chess.isInsufficientMaterial();
  }

  isThreefoldRepetition(): boolean {
    return this.chess.isThreefoldRepetition();
  }

  getResult(): string | null {
    if (!this.isGameOver()) return null;
    if (this.isCheckmate()) {
      return this.getTurn() === 'w' ? 'black' : 'white';
    }
    if (this.isStalemate()) return 'stalemate';
    if (this.isInsufficientMaterial()) return 'insufficient';
    if (this.isThreefoldRepetition()) return 'threefold';
    if (this.chess.isDrawByFiftyMoves()) return 'fifty';
    return 'draw';
  }

  getLegalMoves(square?: Square): Move[] {
    if (square) {
      return this.chess.moves({ square, verbose: true });
    }
    return this.chess.moves({ verbose: true });
  }

  getLegalUci(): string[] {
    return this.getLegalMoves().map((m) => m.from + m.to + (m.promotion || ''));
  }

  makeMove(from: Square, to: Square, promotion?: string): Move | null {
    try {
      const move = this.chess.move({
        from,
        to,
        promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined,
      });
      if (move) {
        this.history.push(move.san);
        this.lastMove = { from, to };
        return move;
      }
    } catch {
      // illegal
    }
    return null;
  }

  makeUciMove(uci: string): Move | null {
    if (uci.length < 4) return null;
    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    const promotion = uci.length > 4 ? uci[4] : undefined;
    return this.makeMove(from, to, promotion);
  }

  undo(): Move | null {
    const move = this.chess.undo();
    if (move) {
      this.history.pop();
      const hist = this.chess.history({ verbose: true });
      if (hist.length > 0) {
        const last = hist[hist.length - 1];
        this.lastMove = { from: last.from, to: last.to };
      } else {
        this.lastMove = null;
      }
    }
    return move;
  }

  getLastMove() {
    return this.lastMove;
  }

  getHistorySan(): string[] {
    return [...this.history];
  }

  getHistoryVerbose(): Move[] {
    return this.chess.history({ verbose: true });
  }

  getPgn(): string {
    return this.chess.pgn();
  }

  getBoard(): (ReturnType<Chess['get']> | null)[][] {
    const board: (ReturnType<Chess['get']> | null)[][] = [];
    const files = 'abcdefgh';
    for (let r = 8; r >= 1; r--) {
      const row: (ReturnType<Chess['get']> | null)[] = [];
      for (const f of files) {
        row.push(this.chess.get(`${f}${r}` as Square));
      }
      board.push(row);
    }
    return board;
  }

  getPiece(square: Square) {
    return this.chess.get(square);
  }

  reset(fen?: string) {
    this.chess = new Chess(fen);
    this.history = [];
    this.lastMove = null;
  }

  loadPgn(pgn: string): boolean {
    try {
      this.chess.loadPgn(pgn);
      this.history = this.chess.history();
      const hist = this.chess.history({ verbose: true });
      if (hist.length) {
        const last = hist[hist.length - 1];
        this.lastMove = { from: last.from, to: last.to };
      }
      return true;
    } catch {
      return false;
    }
  }

  getKingInCheck(): Square | null {
    if (!this.isCheck()) return null;
    const color = this.getTurn();
    const board = this.chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type === 'k' && p.color === color) {
          return (String.fromCharCode(97 + c) + (8 - r)) as Square;
        }
      }
    }
    return null;
  }
}
