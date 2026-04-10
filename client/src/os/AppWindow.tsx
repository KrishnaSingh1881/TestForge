import { createContext, useContext, useRef, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { motion } from 'framer-motion';
import { Rnd } from 'react-rnd';
import WindowTitleBar from './components/WindowTitleBar';
import { useOSStore } from './store/useOSStore';
import type { WindowState } from './store/useOSStore';

// ── Window context — lets children know their window id ──────
export const WindowContext = createContext<string>('');
export const useCurrentWindowId = () => useContext(WindowContext);

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

// ── Motion variants ───────────────────────────────────────────
const reduceMotion = typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const windowVariants = {
  initial: reduceMotion
    ? { opacity: 0 }
    : { scale: 0.85, opacity: 0, y: 20 },
  animate: reduceMotion
    ? { opacity: 1, transition: { duration: 0.15 } }
    : { scale: 1, opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 400, damping: 30 } },
  exit: reduceMotion
    ? { opacity: 0, transition: { duration: 0.1 } }
    : { scale: 0.85, opacity: 0, y: 20, transition: { duration: 0.15, ease: 'easeIn' as const } },
};

// ── AppWindow ─────────────────────────────────────────────────
interface AppWindowProps {
  window: WindowState;
  timerSlot?: ReactNode;
  children: ReactNode;
}

// Menu bar height + dock height for maximized bounds
const MENUBAR_H = 28;
const DOCK_H    = 72;

export default function AppWindow({ window: win, timerSlot, children }: AppWindowProps) {
  const { focusWindow, updatePosition, updateSize, responsiveMode, focusedWindowId } = useOSStore();
  const rndRef = useRef<Rnd>(null);

  const isTablet = responsiveMode === 'tablet';
  const isMobile = responsiveMode === 'mobile';
  const isFocused = focusedWindowId === win.id;

  // Maximized overrides
  const maxStyle = win.isMaximized ? {
    position: 'fixed' as const,
    top: MENUBAR_H,
    left: 0,
    right: 0,
    bottom: DOCK_H,
    width: '100%',
    height: `calc(100vh - ${MENUBAR_H + DOCK_H}px)`,
  } : {};

  // Mobile bottom sheet
  const mobileStyle = isMobile ? {
    position: 'fixed' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: '85vh',
    borderRadius: '1.5rem 1.5rem 0 0',
    width: '100%',
  } : {};

  // Tablet fixed panel — full-width stacked panels
  const tabletStyle = isTablet ? {
    position: 'fixed' as const,
    inset: `${MENUBAR_H}px 0 ${DOCK_H}px 0`,
    width: '100%',
  } : {};

  const overrideStyle = isMobile ? mobileStyle : isTablet ? tabletStyle : win.isMaximized ? maxStyle : {};
  const useRnd = !isMobile && !isTablet && !win.isMaximized;

  // In mobile mode, only show the focused window
  const shouldHideInMobile = isMobile && !isFocused;

  const windowContent = (
    <motion.div
      key={win.id}
      variants={windowVariants}
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
        display: win.isMinimized || shouldHideInMobile ? 'none' : 'flex',
        flexDirection: 'column',
        ...overrideStyle,
      }}
      className="app-window"
      onPointerDown={() => focusWindow(win.id)}
    >
      <WindowContext.Provider value={win.id}>
        <WindowTitleBar
          windowId={win.id}
          title={win.title}
          isLocked={win.isLocked}
          timerSlot={timerSlot}
        />
        <div className="app-window-content flex-1 overflow-hidden">
          <WindowErrorBoundary>
            {children}
          </WindowErrorBoundary>
        </div>
      </WindowContext.Provider>
    </motion.div>
  );

  if (!useRnd) {
    return windowContent;
  }

  return (
    <Rnd
      ref={rndRef}
      position={win.position}
      size={win.size}
      minWidth={320}
      minHeight={240}
      style={{ zIndex: win.zIndex, display: win.isMinimized || shouldHideInMobile ? 'none' : 'block' }}
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
      <motion.div
        key={win.id}
        variants={windowVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
        className="app-window"
      >
        <WindowContext.Provider value={win.id}>
          <WindowTitleBar
            windowId={win.id}
            title={win.title}
            isLocked={win.isLocked}
            timerSlot={timerSlot}
          />
          <div className="app-window-content flex-1 overflow-hidden">
            <WindowErrorBoundary>
              {children}
            </WindowErrorBoundary>
          </div>
        </WindowContext.Provider>
      </motion.div>
    </Rnd>
  );
}
