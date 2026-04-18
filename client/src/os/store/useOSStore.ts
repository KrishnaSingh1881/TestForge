import { create } from 'zustand';

export type AppType =
  | 'tests'
  | 'test-session'
  | 'results'
  | 'analytics'
  | 'question-bank'
  | 'test-manager'
  | 'integrity'
  | 'admin-analytics'
  | 'code-editor'
  | 'test-settings'
  | 'test-settings';

export type ResponsiveMode = 'desktop' | 'tablet' | 'mobile';

export interface WindowState {
  id: string;
  appType: AppType;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  isMinimized: boolean;
  isMaximized: boolean;
  isLocked: boolean;
  zIndex: number;
  prevPosition?: { x: number; y: number };
  prevSize?: { width: number; height: number };
  appProps?: Record<string, unknown>;
}

interface OSStore {
  windows: WindowState[];
  focusedWindowId: string | null;
  nextZIndex: number;
  responsiveMode: ResponsiveMode;

  openWindow: (appType: AppType, appProps?: Record<string, unknown>) => string;
  openWindowExclusive: (appType: AppType, appProps?: Record<string, unknown>) => string;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  unmaximizeWindow: (id: string) => void;
  updatePosition: (id: string, pos: { x: number; y: number }) => void;
  updateSize: (id: string, size: { width: number; height: number }) => void;
  lockWindow: (id: string) => void;
  unlockWindow: (id: string) => void;
  closeAll: () => void;
  setResponsiveMode: (mode: ResponsiveMode) => void;
}

// Default sizes and positions per app type
const APP_DEFAULTS: Record<AppType, { size: { width: number; height: number }; position: { x: number; y: number } }> = {
  'tests':           { size: { width: 760,  height: 560 }, position: { x: 80,  y: 60 } },
  'test-session':    { size: { width: 1100, height: 720 }, position: { x: 60,  y: 40 } },
  'results':         { size: { width: 800,  height: 600 }, position: { x: 100, y: 80 } },
  'analytics':       { size: { width: 900,  height: 640 }, position: { x: 120, y: 70 } },
  'question-bank':   { size: { width: 1000, height: 680 }, position: { x: 80,  y: 50 } },
  'test-manager':    { size: { width: 960,  height: 660 }, position: { x: 100, y: 60 } },
  'integrity':       { size: { width: 1000, height: 680 }, position: { x: 90,  y: 55 } },
  'admin-analytics': { size: { width: 960,  height: 660 }, position: { x: 110, y: 65 } },
  'code-editor':     { size: { width: 1100, height: 720 }, position: { x: 70,  y: 45 } },
  'test-settings':   { size: { width: 720,  height: 580 }, position: { x: 130, y: 70 } },

};

const APP_TITLES: Record<AppType, string> = {
  'tests':           'Tests',
  'test-session':    'Test Session',
  'results':         'Results',
  'analytics':       'Analytics',
  'question-bank':   'Question Bank',
  'test-manager':    'Test Manager',
  'integrity':       'Integrity',
  'admin-analytics': 'Analytics',
  'code-editor':     'Code Editor',
  'test-settings':   'Test Settings',

};

// Singleton app types — only one instance allowed
const SINGLETON_APPS: Set<AppType> = new Set([
  'tests', 'analytics', 'question-bank', 'test-manager', 'admin-analytics', 'results', 'integrity', 'code-editor', 'test-settings',
]);

export const useOSStore = create<OSStore>((set, get) => ({
  windows: [],
  focusedWindowId: null,
  nextZIndex: 100,
  responsiveMode: 'desktop',

  openWindow: (appType, appProps) => {
    const state = get();

    // For test-session with attemptId, use stable ID to prevent duplicates
    let id: string;
    if (appType === 'test-session' && appProps?.attemptId) {
      id = `test-session-${appProps.attemptId}`;
    } else {
      id = `${appType}-${Date.now()}`;
    }

    // Singleton: focus and UPDATE existing window if already open
    if (SINGLETON_APPS.has(appType)) {
      const existing = state.windows.find(w => w.appType === appType);
      if (existing) {
        set(s => ({
          windows: s.windows.map(w => w.id === existing.id ? { ...w, appProps, zIndex: s.nextZIndex } : w),
          focusedWindowId: existing.id,
          nextZIndex: s.nextZIndex + 1
        }));
        if (existing.isMinimized) get().restoreWindow(existing.id);
        return existing.id;
      }
    }

    // Deduplicate by ID (e.g. same test-session)
    const existingById = state.windows.find(w => w.id === id);
    if (existingById) {
      get().focusWindow(id);
      if (existingById.isMinimized) get().restoreWindow(id);
      return id;
    }

    const defaults = APP_DEFAULTS[appType];
    const zIndex = state.nextZIndex;

    // Cascade position slightly for each new window
    const offset = state.windows.length * 24;
    const position = {
      x: defaults.position.x + offset,
      y: defaults.position.y + offset,
    };

    const newWindow: WindowState = {
      id,
      appType,
      title: APP_TITLES[appType],
      position,
      size: defaults.size,
      isMinimized: false,
      isMaximized: false,
      isLocked: false,
      zIndex,
      appProps,
    };

    set(s => ({
      windows: [...s.windows, newWindow],
      focusedWindowId: id,
      nextZIndex: s.nextZIndex + 1,
    }));

    return id;
  },

  // Opens a window and closes ALL other non-locked windows (strict single-app mode)
  openWindowExclusive: (appType, appProps) => {
    // Single atomic set — remove all non-locked windows at once
    set(s => ({
      windows: s.windows.filter(w => w.isLocked),
      focusedWindowId: null,
    }));
    return get().openWindow(appType, appProps);
  },

  closeWindow: (id) => {
    set(s => {
      const remaining = s.windows.filter(w => w.id !== id);
      const focused = s.focusedWindowId === id
        ? (remaining.length > 0 ? remaining[remaining.length - 1].id : null)
        : s.focusedWindowId;
      return { windows: remaining, focusedWindowId: focused };
    });
  },

  focusWindow: (id) => {
    set(s => {
      const zIndex = s.nextZIndex;
      return {
        windows: s.windows.map(w => w.id === id ? { ...w, zIndex } : w),
        focusedWindowId: id,
        nextZIndex: zIndex + 1,
      };
    });
  },

  minimizeWindow: (id) => {
    set(s => ({
      windows: s.windows.map(w => w.id === id ? { ...w, isMinimized: true } : w),
      focusedWindowId: s.focusedWindowId === id ? null : s.focusedWindowId,
    }));
  },

  restoreWindow: (id) => {
    set(s => {
      const zIndex = s.nextZIndex;
      return {
        windows: s.windows.map(w =>
          w.id === id ? { ...w, isMinimized: false, zIndex } : w
        ),
        focusedWindowId: id,
        nextZIndex: zIndex + 1,
      };
    });
  },

  maximizeWindow: (id) => {
    set(s => ({
      windows: s.windows.map(w =>
        w.id === id
          ? { ...w, isMaximized: true, prevPosition: w.position, prevSize: w.size }
          : w
      ),
    }));
  },

  unmaximizeWindow: (id) => {
    set(s => ({
      windows: s.windows.map(w =>
        w.id === id
          ? {
              ...w,
              isMaximized: false,
              position: w.prevPosition ?? w.position,
              size: w.prevSize ?? w.size,
              prevPosition: undefined,
              prevSize: undefined,
            }
          : w
      ),
    }));
  },

  updatePosition: (id, pos) => {
    set(s => ({
      windows: s.windows.map(w => w.id === id ? { ...w, position: pos } : w),
    }));
  },

  updateSize: (id, size) => {
    set(s => ({
      windows: s.windows.map(w => w.id === id ? { ...w, size } : w),
    }));
  },

  lockWindow: (id) => {
    set(s => ({
      windows: s.windows.map(w => w.id === id ? { ...w, isLocked: true } : w),
    }));
  },

  unlockWindow: (id) => {
    set(s => ({
      windows: s.windows.map(w => w.id === id ? { ...w, isLocked: false } : w),
    }));
  },

  closeAll: () => {
    set({ windows: [], focusedWindowId: null });
  },

  setResponsiveMode: (mode) => {
    set({ responsiveMode: mode });
  },
}));
