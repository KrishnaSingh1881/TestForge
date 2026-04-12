import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useOSStore } from './store/useOSStore';
import Desktop from './Desktop';
import MenuBar from './MenuBar';
import Dock from './Dock';
import LockScreen from './LockScreen';
import ClickSpark from '../components/ClickSpark';

export default function OSShell(): JSX.Element {
  const { session, user } = useAuth();
  const { theme } = useTheme();
  const { closeAll, setResponsiveMode } = useOSStore();
  const prevSessionRef = useRef(session);

  // Disable right-click, copy, paste globally for students
  useEffect(() => {
    if (!user || user.role !== 'student') return;

    const block = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', block);
    document.addEventListener('copy', block);
    document.addEventListener('paste', block);
    document.addEventListener('cut', block);

    return () => {
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('copy', block);
      document.removeEventListener('paste', block);
      document.removeEventListener('cut', block);
    };
  }, [user]);

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
      <ClickSpark sparkColor="rgba(255,255,255,0.4)" sparkCount={8} sparkRadius={20}>
        {session === null ? (
          <LockScreen />
        ) : (
          <>
            <Desktop />
            <MenuBar />
            <Dock />
          </>
        )}
      </ClickSpark>
    </div>
  );
}
