import type { GameController } from './gameController';

export function exportPgn(
  game: GameController,
  meta: {
    white?: string;
    black?: string;
    result?: string;
    date?: string;
    event?: string;
  } = {}
): string {
  const headers: string[] = [];
  headers.push(`[Event "${meta.event || 'AIChess Game'}"]`);
  headers.push(`[Site "AIChess"]`);
  headers.push(`[Date "${meta.date || new Date().toISOString().slice(0, 10)}"]`);
  headers.push(`[White "${meta.white || 'Player'}"]`);
  headers.push(`[Black "${meta.black || 'AI'}"]`);
  headers.push(`[Result "${meta.result || '*'}"]`);
  const body = game.getPgn();
  return headers.join('\n') + '\n\n' + body;
}
