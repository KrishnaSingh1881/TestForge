import { useMotionValue } from 'framer-motion';
import { useOSStore } from './store/useOSStore';
import { getAppsForRole } from './apps/registry';
import DockIcon from './components/DockIcon';
import { useAuth } from '../context/AuthContext';

export default function Dock() {
  const { user } = useAuth();
  const { windows, openWindow, focusWindow, restoreWindow, responsiveMode } = useOSStore();
  const mouseX = useMotionValue(Infinity);

  const role = (user?.role ?? 'student') as 'student' | 'admin' | 'super_admin';
  const apps = getAppsForRole(role);
  const isMobile = responsiveMode === 'mobile';

  function handleAppClick(appId: typeof apps[number]['id']) {
    const existing = windows.find(w => w.appType === appId);
    if (existing) {
      if (existing.isMinimized) {
        restoreWindow(existing.id);
      } else {
        focusWindow(existing.id);
      }
    } else {
      openWindow(appId);
    }
  }

  if (isMobile) {
    // Mobile: full-width bottom nav bar
    return (
      <nav
        className="fixed bottom-0 left-0 right-0 flex items-center justify-around px-2 py-2"
        style={{
          background: 'var(--menubar-bg)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--glass-border)',
          height: 64,
          zIndex: 200,
        }}
      >
        {apps.map(app => {
          const isOpen = windows.some(w => w.appType === app.id);
          return (
            <button
              key={app.id}
              onClick={() => handleAppClick(app.id)}
              className="flex flex-col items-center gap-0.5 px-2"
            >
              <span style={{ fontSize: 22 }}>{app.icon}</span>
              <span className="text-[10px]" style={{ color: isOpen ? 'rgb(var(--accent))' : 'rgba(255,255,255,0.5)' }}>
                {app.name}
              </span>
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <div
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[200]"
      onMouseMove={e => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(Infinity)}
    >
      <div className="dock-pill flex items-end gap-2 px-3 py-2">
        {apps.map(app => {
          const openWin = windows.find(w => w.appType === app.id);
          const isOpen = !!openWin;
          const isMinimized = openWin?.isMinimized ?? false;

          return (
            <DockIcon
              key={app.id}
              app={app}
              isOpen={isOpen}
              isMinimized={isMinimized}
              mouseX={mouseX}
              onClick={() => handleAppClick(app.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
