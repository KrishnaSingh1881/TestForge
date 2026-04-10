import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useOSStore } from './store/useOSStore';
import Desktop from './Desktop';
import MenuBar from './MenuBar';
import Dock from './Dock';
import LockScreen from './LockScreen';

export default function OSShell(): JSX.Element {
  const { session } = useAuth();
  const { theme } = useTheme();
  const { closeAll, setResponsiveMode } = useOSStore();
  const prevSessionRef = useRef(session);

  // Set data-theme attribute on document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Prevent browser scroll on desktop layer
  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, []);

  // ResizeObserver to set responsive mode based on viewport width
  useEffect(() => {
    const updateResponsiveMode = (width: number) => {
      if (width >= 1024) {
        setResponsiveMode('desktop');
      } else if (width >= 768) {
        setResponsiveMode('tablet');
      } else {
        setResponsiveMode('mobile');
      }
    };

    // Set initial mode
    updateResponsiveMode(document.body.clientWidth);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        updateResponsiveMode(entry.contentRect.width);
      }
    });

    observer.observe(document.body);

    return () => {
      observer.disconnect();
    };
  }, [setResponsiveMode]);

  // Close all windows on sign-out (when session becomes null)
  useEffect(() => {
    const wasAuthenticated = prevSessionRef.current !== null;
    const isNowUnauthenticated = session === null;

    if (wasAuthenticated && isNowUnauthenticated) {
      closeAll();
    }

    prevSessionRef.current = session;
  }, [session, closeAll]);

  return (
    <div className="os-shell">
      {session === null ? (
        <LockScreen />
      ) : (
        <>
          <Desktop />
          <MenuBar />
          <Dock />
        </>
      )}
    </div>
  );
}
