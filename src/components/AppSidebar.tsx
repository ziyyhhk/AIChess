import React from 'react';

type View = 'play' | 'opponents' | 'history' | 'analysis' | 'settings' | 'help';

interface Props {
  active: View;
  onNavigate: (v: View) => void;
  collapsed?: boolean;
}

const items: { id: View; label: string; icon: string }[] = [
  { id: 'play', label: 'Play', icon: '♟' },
  { id: 'opponents', label: 'AI Opponents', icon: '🤖' },
  { id: 'history', label: 'Game History', icon: '📜' },
  { id: 'analysis', label: 'Analysis', icon: '🔍' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
  { id: 'help', label: 'Help / About', icon: '❓' },
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
        flexShrink: 0,
        transition: 'width 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 16 }}>
        <span style={{ fontSize: 24 }}>♞</span>
        {!collapsed && (
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: 0.5 }}>AIChess</span>
        )}
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 6,
              background: active === item.id ? 'var(--bg-elevated)' : 'transparent',
              color: active === item.id ? 'var(--accent)' : 'var(--text-muted)',
              textAlign: 'left',
              fontWeight: active === item.id ? 600 : 400,
            }}
            title={item.label}
          >
            <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
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
