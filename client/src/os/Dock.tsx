import { useMotionValue } from 'framer-motion';
import { useOSStore } from './store/useOSStore';
import { getAppsForRole } from './apps/registry';
import DockIcon from './components/DockIcon';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useOSSettings } from './store/useOSSettings';
import { useState } from 'react';

export default function Dock() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { windows, openWindow, focusWindow, restoreWindow, responsiveMode } = useOSStore();
  const { dockAutohide } = useOSSettings();
  const mouseX = useMotionValue(Infinity);
  const isLight = theme === 'light';
  const [hovered, setHovered] = useState(false);

  const role = (user?.role ?? 'student') as 'student' | 'admin' | 'super_admin';
  const apps = getAppsForRole(role);
  const isMobile = responsiveMode === 'mobile';

  function handleAppClick(appId: typeof apps[number]['id']) {
    const existing = windows.find(w => w.appType === appId);

    if (existing) {
      if (existing.isLocked) {
        focusWindow(existing.id);
        return;
      }
      if (existing.isMinimized) {
        restoreWindow(existing.id);
        return;
      }
      // Already open — just focus it
      focusWindow(existing.id);
    } else {
      // Open a new window — multiple apps allowed
      openWindow(appId);
    }
  }

  if (isMobile) {
    return (
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        padding: '8px 12px',
        background: 'rgba(15,10,40,0.85)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(120,100,200,0.2)',
        height: 64, zIndex: 200,
      }}>
        {apps.map(app => {
          const isOpen = windows.some(w => w.appType === app.id && !w.isMinimized);
          return (
            <button key={app.id} onClick={() => handleAppClick(app.id)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer' }}>
              <span style={{ fontSize: 22 }}>{app.icon}</span>
              <span style={{ fontSize: 10, color: isOpen ? 'rgb(167,139,250)' : 'rgba(255,255,255,0.4)' }}>{app.name}</span>
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <>
    <div
      style={{
        position: 'fixed',
        bottom: dockAutohide ? (hovered ? 16 : -90) : 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200,
        transition: dockAutohide
          ? 'bottom 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), background 0.8s ease, border-color 0.8s ease'
          : 'background 0.8s ease, border-color 0.8s ease, box-shadow 0.8s ease',
        background: isLight
          ? 'rgba(210, 175, 120, 0.45)'
          : 'rgba(20, 14, 50, 0.55)',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        border: isLight
          ? '1px solid rgba(180, 130, 60, 0.35)'
          : '1px solid rgba(120, 90, 200, 0.25)',
        borderRadius: 24,
        padding: '10px 14px',
        boxShadow: isLight
          ? '0 8px 32px rgba(120,80,20,0.25), inset 0 1px 0 rgba(255,220,150,0.2)'
          : '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
      }}
      onMouseMove={e => mouseX.set(e.clientX)}
      onMouseLeave={() => { mouseX.set(Infinity); setHovered(false); }}
      onMouseEnter={() => setHovered(true)}
    >
      {apps.map(app => {
        const openWin = windows.find(w => w.appType === app.id);
        const isOpen = !!openWin;
        const isMinimized = openWin?.isMinimized ?? false;
        const isActive = isOpen && !isMinimized;

        return (
          <DockIcon
            key={app.id}
            app={app}
            isOpen={isOpen}
            isActive={isActive}
            isMinimized={isMinimized}
            isLight={isLight}
            mouseX={mouseX}
            onClick={() => handleAppClick(app.id)}
          />
        );
      })}
    </div>

    {/* Autohide trigger zone — invisible strip at bottom edge */}
    {dockAutohide && (
      <div
        style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 20, zIndex: 199 }}
        onMouseEnter={() => setHovered(true)}
      />
    )}
  </>
  );
}
