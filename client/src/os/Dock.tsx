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

  const role = (user?.role ?? 'student') as 'student' | 'admin' | 'super_admin' | 'master_admin';
  const apps = getAppsForRole(role);
  const isMobile = responsiveMode === 'mobile';
  const hasMaximized = windows.some(w => w.isMaximized && !w.isMinimized);

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
        position: 'fixed', bottom: 12, left: 12, right: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        padding: '8px',
        background: 'rgba(15, 12, 35, 0.45)',
        backdropFilter: 'blur(30px) saturate(200%)',
        WebkitBackdropFilter: 'blur(30px) saturate(200%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 20,
        height: 68, zIndex: 200,
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
      }}>
        {apps.map(app => {
          const isOpen = windows.some(w => w.appType === app.id && !w.isMinimized);
          return (
            <button key={app.id} onClick={() => handleAppClick(app.id)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', flex: 1 }}>
              <span style={{ fontSize: 24, opacity: isOpen ? 1 : 0.6, filter: isOpen ? 'drop-shadow(0 0 8px rgba(99,102,241,0.5))' : 'none' }}>{app.icon}</span>
              <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: isOpen ? '#818cf8' : 'rgba(255,255,255,0.3)' }}>{app.name}</span>
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
        bottom: hasMaximized ? -200 : dockAutohide ? (hovered ? 16 : -90) : 16,
        pointerEvents: hasMaximized ? 'none' : 'auto',
        opacity: hasMaximized ? 0 : 1,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200,
        transition: 'all 0.6s cubic-bezier(0.23, 1, 0.32, 1)',
        background: isLight
          ? 'rgba(255, 255, 255, 0.35)'
          : 'rgba(15, 12, 35, 0.35)',
        backdropFilter: 'blur(40px) saturate(200%)',
        WebkitBackdropFilter: 'blur(40px) saturate(200%)',
        border: isLight
          ? '1px solid rgba(0, 0, 0, 0.08)'
          : '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 28,
        padding: '10px 14px',
        boxShadow: isLight
          ? '0 20px 40px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.4)'
          : '0 20px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 12,
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
    {dockAutohide && !hasMaximized && (
      <div
        style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 20, zIndex: 199 }}
        onMouseEnter={() => setHovered(true)}
      />
    )}
  </>
  );
}
