import React from 'react';
import {
  IconPlay,
  IconBot,
  IconHistory,
  IconSearch,
  IconSettings,
  IconHelp,
} from './Icons';

type View = 'play' | 'opponents' | 'history' | 'analysis' | 'settings' | 'help';

interface Props {
  active: View;
  onNavigate: (v: View) => void;
  collapsed?: boolean;
}

const items: { id: View; label: string; Icon: React.FC<React.SVGProps<SVGSVGElement>> }[] = [
  { id: 'play', label: 'Play', Icon: IconPlay },
  { id: 'opponents', label: 'AI Opponents', Icon: IconBot },
  { id: 'history', label: 'Game History', Icon: IconHistory },
  { id: 'analysis', label: 'Analysis', Icon: IconSearch },
  { id: 'settings', label: 'Settings', Icon: IconSettings },
  { id: 'help', label: 'Help / About', Icon: IconHelp },
];

export function AppSidebar({ active, onNavigate, collapsed }: Props) {
  return (
    <aside
      className="sidebar"
      style={{
        width: collapsed ? 56 : 'var(--sidebar-w)',
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 8px',
        gap: 4,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: '8px 10px',
          fontWeight: 700,
          fontSize: collapsed ? 12 : 16,
          letterSpacing: 0.3,
          color: 'var(--text)',
        }}
      >
        {collapsed ? 'AC' : 'AIChess'}
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              title={item.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                background: isActive ? 'var(--bg-elevated)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                textAlign: 'left',
                fontWeight: isActive ? 600 : 400,
                fontSize: 14,
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <item.Icon width={18} height={18} />
              </span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>
      <div style={{ flex: 1 }} />
      {!collapsed && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: 8 }}>
          Play vs free AI models
        </div>
      )}
    </aside>
  );
}
