import React, { useState } from 'react';
import {
  describeResult,
  formatPlayed,
  type ArchivedGame,
} from '../history/archive';

interface Props {
  games: ArchivedGame[];
  onCopy: (pgn: string) => Promise<boolean>;
  onDownload: (entry: ArchivedGame) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

/**
 * The History view: the games this browser has finished (or abandoned), newest
 * first, each one exportable again. Nothing here is invented - a row exists only
 * because a real game was archived.
 */
export function HistoryView({ games, onCopy, onDownload, onDelete, onClear }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const copy = async (pgn: string, id: string) => {
    const ok = await onCopy(pgn);
    setNote(ok ? 'PGN copied to the clipboard.' : 'Copying was blocked — open the PGN and select it manually.');
    if (!ok) setExpanded(id);
    window.setTimeout(() => setNote(null), 4000);
  };

  return (
    <section className="history-view" aria-label="Game history">
      <header className="history-head">
        <div>
          <h1>History</h1>
          <p className="history-sub">
            {games.length === 0
              ? 'Finished games are stored in this browser only.'
              : `${games.length} game${games.length === 1 ? '' : 's'} stored in this browser (most recent first).`}
          </p>
        </div>
        {games.length > 0 && (
          <button type="button" className="btn ghost" onClick={onClear}>
            Clear all
          </button>
        )}
      </header>

      {note && <p className="history-note">{note}</p>}

      {games.length === 0 ? (
        <div className="history-empty">
          <p>No games yet.</p>
          <p className="hs-muted">
            Play a game and it will be listed here with its PGN, ready to copy or download.
          </p>
        </div>
      ) : (
        <ul className="history-list">
          {games.map((game) => {
            const isOpen = expanded === game.id;
            return (
              <li key={game.id} className="history-item">
                <div className="history-row">
                  <div className="history-when">
                    <span className="history-date">{formatPlayed(game.finishedAt)}</span>
                    <span className="history-players">
                      {game.white} <span className="hs-muted">vs</span> {game.black}
                    </span>
                  </div>
                  <div className="history-facts">
                    <span className={`history-result${game.unfinished || game.result === '*' ? ' is-open' : ''}`}>
                      {describeResult(game)}
                    </span>
                    <span className="hs-muted">{Math.round(game.plies / 2)} moves</span>
                    <span className="history-score">{game.result}</span>
                  </div>
                  <div className="history-actions">
                    <button type="button" className="btn hs-btn" onClick={() => void copy(game.pgn, game.id)}>
                      Copy PGN
                    </button>
                    <button type="button" className="btn hs-btn" onClick={() => onDownload(game)}>
                      Download
                    </button>
                    <button
                      type="button"
                      className="btn ghost hs-btn"
                      onClick={() => setExpanded(isOpen ? null : game.id)}
                      aria-expanded={isOpen}
                    >
                      {isOpen ? 'Hide PGN' : 'Show PGN'}
                    </button>
                    <button
                      type="button"
                      className="btn ghost hs-btn"
                      onClick={() => onDelete(game.id)}
                      aria-label="Delete this game from history"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <textarea className="history-pgn" readOnly value={game.pgn} rows={8} spellCheck={false} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
