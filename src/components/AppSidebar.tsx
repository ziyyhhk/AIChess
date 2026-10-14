import React from 'react';

type View = 'play' | 'opponents' | 'history' | 'analysis' | 'puzzles' | 'settings' | 'help';

interface Props {
  active: View;
  onNavigate: (v: View) => void;
}

/** Plain section names. Text only: the list itself is the structure. */
const items: { id: View; label: string }[] = [
  { id: 'play', label: 'Play' },
  { id: 'opponents', label: 'Opponents' },
  { id: 'history', label: 'History' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'puzzles', label: 'Puzzles' },
  { id: 'settings', label: 'Settings' },
  { id: 'help', label: 'About' },
];

export function AppSidebar({ active, onNavigate }: Props) {
  return (
    <aside className="sidebar" aria-label="Sidebar">
      <div className="brand">
        <span className="brand-text">
          <span className="brand-name">AIChess</span>
        </span>
      </div>
      <nav className="nav" aria-label="Sections">
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item${isActive ? ' active' : ''}`}
              onClick={() => onNavigate(item.id)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="sidebar-foot">Stockfish is built in. Hosted models need a key.</div>
    </aside>
  );
}
