import { useEffect, useRef, useState } from 'react';
import { useOSStore } from './store/useOSStore';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function MenuBar() {
  const { windows, focusedWindowId, responsiveMode } = useOSStore();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { closeAll } = useOSStore();

  const [clock, setClock] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isMobile = responsiveMode === 'mobile';

  // Clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeTitle = focusedWindowId
    ? windows.find(w => w.id === focusedWindowId)?.title ?? 'TestForge'
    : 'TestForge';

  async function handleSignOut() {
    setDropdownOpen(false);
    closeAll();
    await signOut();
  }

  return (
    <header
      className="menu-bar fixed top-0 left-0 right-0 flex items-center justify-between px-4 z-[300]"
      style={{ height: 28 }}
    >
      {/* Left — app name */}
      {!isMobile && (
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>
            Test<span style={{ color: 'rgb(var(--accent))' }}>Forge</span>
          </span>
          <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {activeTitle}
          </span>
        </div>
      )}

      {/* Right — clock, theme, avatar */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="text-xs px-1.5 py-0.5 rounded transition-opacity hover:opacity-80"
          style={{ color: 'rgba(255,255,255,0.7)' }}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        {/* Clock */}
        <span className="text-xs tabular-nums" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {clock}
        </span>

        {/* User avatar + dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(v => !v)}
            className="flex items-center gap-1.5 rounded-full px-1.5 py-0.5 transition-colors hover:bg-white/10"
          >
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{ background: 'rgb(var(--accent))', color: '#fff' }}
            >
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            {!isMobile && (
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {user?.name?.split(' ')[0]}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div
              className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden shadow-xl"
              style={{
                background: 'rgba(30,41,59,0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--glass-border)',
                minWidth: 160,
                zIndex: 9999,
              }}
            >
              <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--glass-border)' }}>
                <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>{user?.name}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{user?.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/10"
                style={{ color: '#f87171' }}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
