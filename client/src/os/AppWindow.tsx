import { createContext, useContext, useRef, Component, useState, useEffect } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rnd } from 'react-rnd';
import WindowTitleBar from './components/WindowTitleBar';
import { useOSStore } from './store/useOSStore';
import type { WindowState } from './store/useOSStore';

// ── Window context ────────────────────────────────────────────
export const WindowContext = createContext<string>('');
export const useCurrentWindowId = () => useContext(WindowContext);

// ── Dock icon ref registry (appType → DOM element) ────────────
const dockIconRefs = new Map<string, HTMLElement>();
export function registerDockIconRef(appType: string, el: HTMLElement | null) {
  if (el) dockIconRefs.set(appType, el);
  else dockIconRefs.delete(appType);
}
export function getDockIconRect(appType: string): DOMRect | null {
  return dockIconRefs.get(appType)?.getBoundingClientRect() ?? null;
}

// ── Error boundary ────────────────────────────────────────────
interface EBState { hasError: boolean; }
class WindowErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false };
  static getDerivedStateFromError(): EBState { return { hasError: true }; }
  componentDidCatch(err: Error, info: ErrorInfo) { console.error('AppWindow crash:', err, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
          <p className="text-sm" style={{ color: '#f87171' }}>Something went wrong in this window.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
            style={{ backgroundColor: 'rgb(99 102 241)' }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── AppWindow ─────────────────────────────────────────────────
interface AppWindowProps {
  window: WindowState;
  timerSlot?: ReactNode;
  children: ReactNode;
}

const MENUBAR_H = 28;
const DOCK_H    = 72;

const reduceMotion = typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function AppWindow({ window: win, timerSlot, children }: AppWindowProps) {
  const { focusWindow, updatePosition, updateSize, responsiveMode, focusedWindowId } = useOSStore();
  const rndRef = useRef<Rnd>(null);
  const windowRef = useRef<HTMLDivElement>(null);

  // Track dock icon position for minimize animation
  const [minimizeTarget, setMinimizeTarget] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (win.isMinimized) {
      const rect = getDockIconRect(win.appType);
      if (rect) {
        setMinimizeTarget({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      }
    }
  }, [win.isMinimized, win.appType]);

  const isTablet = responsiveMode === 'tablet';
  const isMobile = responsiveMode === 'mobile';
  const isFocused = focusedWindowId === win.id;

  const maxStyle = win.isMaximized ? {
    position: 'fixed' as const,
    top: MENUBAR_H, left: 0, right: 0, bottom: DOCK_H,
    width: '100%',
    height: `calc(100vh - ${MENUBAR_H + DOCK_H}px)`,
  } : {};

  const mobileStyle = isMobile ? {
    position: 'fixed' as const,
    bottom: 0, left: 0, right: 0,
    height: '85vh',
    borderRadius: '1.5rem 1.5rem 0 0',
    width: '100%',
  } : {};

  const tabletStyle = isTablet ? {
    position: 'fixed' as const,
    inset: `${MENUBAR_H}px 0 ${DOCK_H}px 0`,
    width: '100%',
  } : {};

  const overrideStyle = isMobile ? mobileStyle : isTablet ? tabletStyle : win.isMaximized ? maxStyle : {};
  const useRnd = !isMobile && !isTablet && !win.isMaximized;
  const shouldHideInMobile = isMobile && !isFocused;

  // Build animation variants based on dock position
  const windowX = win.position.x + win.size.width / 2;
  const windowY = win.position.y + win.size.height / 2;
  const dockX = minimizeTarget?.x ?? windowX;
  const dockY = minimizeTarget?.y ?? (window.innerHeight - DOCK_H / 2);

  const variants = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.15 } },
        exit:    { opacity: 0, transition: { duration: 0.1 } },
        minimized: { opacity: 0, transition: { duration: 0.1 } },
      }
    : {
        initial: {
          scale: 0.6,
          opacity: 0,
          x: dockX - windowX,
          y: dockY - windowY,
        },
        animate: {
          scale: 1,
          opacity: 1,
          x: 0,
          y: 0,
          transition: { type: 'spring' as const, stiffness: 380, damping: 28, mass: 0.8 },
        },
        exit: {
          scale: 0.75,
          opacity: 0,
          y: 20,
          transition: { duration: 0.18, ease: 'easeIn' as const },
        },
        minimized: {
          scale: 0.1,
          opacity: 0,
          x: dockX - windowX,
          y: dockY - windowY,
          transition: { type: 'spring' as const, stiffness: 320, damping: 30 },
        },
      };

  const innerContent = (
    <WindowContext.Provider value={win.id}>
      <WindowTitleBar
        windowId={win.id}
        title={win.title}
        isLocked={win.isLocked}
        timerSlot={timerSlot}
      />
      <div className="app-window-content flex-1 overflow-auto">
        <WindowErrorBoundary>
          {children}
        </WindowErrorBoundary>
      </div>
    </WindowContext.Provider>
  );

  if (!useRnd) {
    return (
      <AnimatePresence>
        {!win.isMinimized && !shouldHideInMobile && (
          <motion.div
            key={win.id}
            ref={windowRef}
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{
              position: 'absolute',
              left: win.position.x,
              top: win.position.y,
              width: win.size.width,
              height: win.size.height,
              zIndex: win.zIndex,
              display: 'flex',
              flexDirection: 'column',
              ...overrideStyle,
            }}
            className="app-window"
            onPointerDown={() => focusWindow(win.id)}
          >
            {innerContent}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <Rnd
      ref={rndRef}
      position={win.position}
      size={win.size}
      minWidth={320}
      minHeight={240}
      style={{ zIndex: win.zIndex, display: win.isMinimized ? 'none' : 'block' }}
      disableDragging={win.isLocked}
      enableResizing={win.isLocked ? false : undefined}
      dragHandleClassName="app-window-titlebar"
      onDragStop={(_, d) => updatePosition(win.id, { x: d.x, y: d.y })}
      onResizeStop={(_, __, ref, ___, pos) => {
        updateSize(win.id, {
          width: parseInt(ref.style.width),
          height: parseInt(ref.style.height),
        });
        updatePosition(win.id, pos);
      }}
      onMouseDown={() => focusWindow(win.id)}
    >
      <AnimatePresence>
        {!win.isMinimized && (
          <motion.div
            key={win.id}
            ref={windowRef}
            variants={variants}
            initial="initial"
            animate="animate"
            exit={win.isMinimized ? 'minimized' : 'exit'}
            style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
            className="app-window"
          >
            {innerContent}
          </motion.div>
        )}
      </AnimatePresence>
    </Rnd>
  );
}
