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

  const isLight = theme === 'light';
  const textPrimary   = isLight ? 'rgba(40,25,8,0.9)'  : 'rgba(255,255,255,0.9)';
  const textSecondary = isLight ? 'rgba(100,65,20,0.7)' : 'rgba(255,255,255,0.6)';
  const textMuted     = isLight ? 'rgba(120,80,30,0.6)' : 'rgba(255,255,255,0.7)';
  const hoverBg       = isLight ? 'rgba(140,90,20,0.12)' : 'rgba(255,255,255,0.1)';
  const dropdownBg    = isLight ? 'rgba(235,210,170,0.97)' : 'rgba(30,41,59,0.95)';

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
          <span className="text-xs font-bold" style={{ color: textPrimary }}>
            Test<span style={{ color: 'rgb(var(--accent))' }}>Forge</span>
          </span>
          <span className="text-xs font-medium" style={{ color: textSecondary }}>
            {activeTitle}
          </span>
        </div>
      )}

      {/* Right — clock, theme, avatar */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Theme toggle — pill switch with sun/moon SVG */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          style={{
            position: 'relative',
            width: 44,
            height: 24,
            borderRadius: 999,
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0,
            background: isLight
              ? 'rgba(200, 140, 40, 0.45)'
              : 'rgba(80, 60, 160, 0.5)',
            boxShadow: isLight
              ? 'inset 0 0 0 1px rgba(160,100,20,0.5)'
              : 'inset 0 0 0 1px rgba(140,120,255,0.4)',
            transition: 'background 0.5s ease, box-shadow 0.5s ease',
          }}
        >
          {/* Track icons — sun on right, moon on left, fading */}
          <span style={{
            position: 'absolute', left: 5, top: '50%', transform: 'translateY(-50%)',
            fontSize: 10, opacity: isLight ? 0 : 0.5, transition: 'opacity 0.4s',
            pointerEvents: 'none',
          }}>🌙</span>
          <span style={{
            position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)',
            fontSize: 10, opacity: isLight ? 0.6 : 0, transition: 'opacity 0.4s',
            pointerEvents: 'none',
          }}>☀️</span>

          {/* Sliding knob with morphing SVG */}
          <span style={{
            position: 'absolute',
            top: 3,
            left: isLight ? 23 : 3,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: isLight
              ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
              : 'linear-gradient(135deg, #c4b5fd, #818cf8)',
            boxShadow: isLight
              ? '0 0 8px rgba(251,191,36,0.7), 0 1px 3px rgba(0,0,0,0.2)'
              : '0 0 8px rgba(129,140,248,0.6), 0 1px 3px rgba(0,0,0,0.3)',
            transition: 'left 0.35s cubic-bezier(0.34,1.56,0.64,1), background 0.5s ease, box-shadow 0.5s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              style={{ transition: 'transform 0.5s ease, opacity 0.4s ease' }}
            >
              {isLight ? (
                // Sun rays
                <>
                  <circle cx="12" cy="12" r="5" fill="#92400e" fillOpacity="0.9"/>
                  {[0,45,90,135,180,225,270,315].map((deg, i) => (
                    <line
                      key={i}
                      x1={12 + 7.5 * Math.cos(deg * Math.PI / 180)}
                      y1={12 + 7.5 * Math.sin(deg * Math.PI / 180)}
                      x2={12 + 10 * Math.cos(deg * Math.PI / 180)}
                      y2={12 + 10 * Math.sin(deg * Math.PI / 180)}
                      stroke="#92400e" strokeWidth="2" strokeLinecap="round"
                    />
                  ))}
                </>
              ) : (
                // Crescent moon
                <path
                  d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                  fill="#4c1d95" fillOpacity="0.85"
                />
              )}
            </svg>
          </span>
        </button>

        {/* Clock */}
        <span className="text-xs tabular-nums" style={{ color: textMuted }}>
          {clock}
        </span>

        {/* User avatar + dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(v => !v)}
            className="flex items-center gap-1.5 rounded-full px-1.5 py-0.5 transition-colors"
            onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{ background: 'rgb(var(--accent))', color: '#fff' }}
            >
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            {!isMobile && (
              <span className="text-xs" style={{ color: textMuted }}>
                {user?.name?.split(' ')[0]}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div
              className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden shadow-xl"
              style={{
                background: dropdownBg,
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--glass-border)',
                minWidth: 160,
                zIndex: 9999,
              }}
            >
              <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--glass-border)' }}>
                <p className="text-xs font-medium" style={{ color: textPrimary }}>{user?.name}</p>
                <p className="text-xs" style={{ color: textSecondary }}>{user?.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full text-left px-3 py-2 text-xs transition-colors"
                style={{ color: '#f87171' }}
                onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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
