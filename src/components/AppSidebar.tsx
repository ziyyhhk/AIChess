import React from 'react';
import {
  IconPlay,
  IconBot,
  IconHistory,
  IconSearch,
  IconSettings,
  IconHelp,
} from './Icons';
import { pieceSrc } from '../chess/pieceAssets';

type View = 'play' | 'opponents' | 'history' | 'analysis' | 'puzzles' | 'settings' | 'help';

interface Props {
  active: View;
  onNavigate: (v: View) => void;
}

const items: { id: View; label: string; Icon: React.FC<React.SVGProps<SVGSVGElement>> }[] = [
  { id: 'play', label: 'Play', Icon: IconPlay },
  { id: 'opponents', label: 'Opponents', Icon: IconBot },
  { id: 'history', label: 'History', Icon: IconHistory },
  { id: 'analysis', label: 'Analysis', Icon: IconSearch },
  { id: 'puzzles', label: 'Puzzles', Icon: IconSearch },
  { id: 'settings', label: 'Settings', Icon: IconSettings },
  { id: 'help', label: 'About', Icon: IconHelp },
];

export function AppSidebar({ active, onNavigate }: Props) {
  return (
    <aside className="sidebar" aria-label="Sidebar">
      <div className="brand">
        <img className="brand-mark" src={pieceSrc('w', 'n')} alt="" width={30} height={30} draggable={false} />
        <div className="brand-text">
          <span className="brand-name">AIChess</span>
          <span className="brand-sub">Chess against AI</span>
        </div>
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
              title={item.label}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.Icon className="nav-icon" aria-hidden="true" />
              <span className="nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="sidebar-foot">Stockfish is built in. Hosted models need a key.</div>
    </aside>
  );
}
