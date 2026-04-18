import { describe, it, expect, beforeEach } from 'vitest';
import { useOSStore } from './useOSStore';
import type { AppType } from './useOSStore';

describe('useOSStore - Property Tests', () => {
  beforeEach(() => {
    // Reset store state before each test
    useOSStore.setState({
      windows: [],
      focusedWindowId: null,
      nextZIndex: 100,
      responsiveMode: 'desktop',
    });
  });

  describe('Property 1: All zIndex values are unique', () => {
    it('should assign unique zIndex values when opening N windows', () => {
      const { openWindow } = useOSStore.getState();
      const N = 10;

      // Use test-session with different attemptIds to ensure unique windows
      for (let i = 0; i < N; i++) {
        openWindow('test-session', { attemptId: `attempt-${i}` });
      }

      // Get all zIndex values
      const state = useOSStore.getState();
      const zIndexValues = state.windows.map(w => w.zIndex);

      // Assert all zIndex values are distinct
      const uniqueZIndexValues = new Set(zIndexValues);
      expect(uniqueZIndexValues.size).toBe(zIndexValues.length);
      expect(zIndexValues.length).toBe(N);
    });

    it('should maintain unique zIndex values across 50 window operations', () => {
      const { openWindow } = useOSStore.getState();

      // Open 50 windows with unique attemptIds
      for (let i = 0; i < 50; i++) {
        openWindow('test-session', { attemptId: `attempt-${i}` });
      }

      const state = useOSStore.getState();
      const zIndexValues = state.windows.map(w => w.zIndex);
      const uniqueZIndexValues = new Set(zIndexValues);

      expect(uniqueZIndexValues.size).toBe(zIndexValues.length);
    });
  });

  describe('Property 2: focusWindow gives highest zIndex', () => {
    it('should assign the highest zIndex to the focused window', () => {
      const { openWindow, focusWindow } = useOSStore.getState();

      // Open 5 windows
      const id1 = openWindow('tests');
      openWindow('results');
      openWindow('analytics');
      openWindow('question-bank');
      openWindow('test-manager');

      // Focus the first window (which should have the lowest zIndex)
      focusWindow(id1);

      const state = useOSStore.getState();
      const focusedWindow = state.windows.find(w => w.id === id1);
      const allZIndexValues = state.windows.map(w => w.zIndex);
      const maxZIndex = Math.max(...allZIndexValues);

      // Assert the focused window has the maximum zIndex
      expect(focusedWindow?.zIndex).toBe(maxZIndex);
    });

    it('should maintain highest zIndex property after multiple focus operations', () => {
      const { openWindow, focusWindow } = useOSStore.getState();

      // Open windows
      const id1 = openWindow('tests');
      const id2 = openWindow('results');
      const id3 = openWindow('analytics');

      // Focus windows in different order
      focusWindow(id2);
      let state = useOSStore.getState();
      let focusedWindow = state.windows.find(w => w.id === id2);
      let maxZIndex = Math.max(...state.windows.map(w => w.zIndex));
      expect(focusedWindow?.zIndex).toBe(maxZIndex);

      focusWindow(id1);
      state = useOSStore.getState();
      focusedWindow = state.windows.find(w => w.id === id1);
      maxZIndex = Math.max(...state.windows.map(w => w.zIndex));
      expect(focusedWindow?.zIndex).toBe(maxZIndex);

      focusWindow(id3);
      state = useOSStore.getState();
      focusedWindow = state.windows.find(w => w.id === id3);
      maxZIndex = Math.max(...state.windows.map(w => w.zIndex));
      expect(focusedWindow?.zIndex).toBe(maxZIndex);
    });

    it('should give highest zIndex even when focusing an already-focused window', () => {
      const { openWindow, focusWindow } = useOSStore.getState();

      const id1 = openWindow('tests');
      openWindow('results');

      // Focus id1 twice
      focusWindow(id1);
      const zIndexAfterFirstFocus = useOSStore.getState().windows.find(w => w.id === id1)?.zIndex;

      focusWindow(id1);
      const state = useOSStore.getState();
      const focusedWindow = state.windows.find(w => w.id === id1);
      const maxZIndex = Math.max(...state.windows.map(w => w.zIndex));

      expect(focusedWindow?.zIndex).toBe(maxZIndex);
      expect(focusedWindow?.zIndex).toBeGreaterThan(zIndexAfterFirstFocus!);
    });
  });

  describe('Property 3: minimizeWindow then restoreWindow preserves position/size', () => {
    it('should preserve position and size after minimize and restore', () => {
      const { openWindow, minimizeWindow, restoreWindow } = useOSStore.getState();

      // Open a window
      const id = openWindow('tests');
      const initialState = useOSStore.getState();
      const initialWindow = initialState.windows.find(w => w.id === id)!;
      const initialPosition = { ...initialWindow.position };
      const initialSize = { ...initialWindow.size };

      // Minimize the window
      minimizeWindow(id);
      const minimizedState = useOSStore.getState();
      const minimizedWindow = minimizedState.windows.find(w => w.id === id)!;
      expect(minimizedWindow.isMinimized).toBe(true);

      // Restore the window
      restoreWindow(id);
      const restoredState = useOSStore.getState();
      const restoredWindow = restoredState.windows.find(w => w.id === id)!;

      // Assert isMinimized is false
      expect(restoredWindow.isMinimized).toBe(false);

      // Assert position and size are unchanged
      expect(restoredWindow.position).toEqual(initialPosition);
      expect(restoredWindow.size).toEqual(initialSize);
    });

    it('should preserve position and size for multiple windows through minimize/restore cycles', () => {
      const { openWindow, minimizeWindow, restoreWindow } = useOSStore.getState();

      // Open multiple windows
      const id1 = openWindow('tests');
      const id2 = openWindow('results');
      const id3 = openWindow('analytics');

      const initialState = useOSStore.getState();
      const window1Initial = initialState.windows.find(w => w.id === id1)!;
      const window2Initial = initialState.windows.find(w => w.id === id2)!;
      const window3Initial = initialState.windows.find(w => w.id === id3)!;

      const positions = {
        [id1]: { ...window1Initial.position },
        [id2]: { ...window2Initial.position },
        [id3]: { ...window3Initial.position },
      };
      const sizes = {
        [id1]: { ...window1Initial.size },
        [id2]: { ...window2Initial.size },
        [id3]: { ...window3Initial.size },
      };

      // Minimize all windows
      minimizeWindow(id1);
      minimizeWindow(id2);
      minimizeWindow(id3);

      // Restore all windows
      restoreWindow(id1);
      restoreWindow(id2);
      restoreWindow(id3);

      const finalState = useOSStore.getState();

      // Assert all windows have isMinimized = false and preserved position/size
      [id1, id2, id3].forEach(id => {
        const window = finalState.windows.find(w => w.id === id)!;
        expect(window.isMinimized).toBe(false);
        expect(window.position).toEqual(positions[id]);
        expect(window.size).toEqual(sizes[id]);
      });
    });

    it('should preserve position and size even after manual position/size updates', () => {
      const { openWindow, updatePosition, updateSize, minimizeWindow, restoreWindow } = useOSStore.getState();

      // Open a window
      const id = openWindow('tests');

      // Update position and size manually
      const newPosition = { x: 200, y: 150 };
      const newSize = { width: 900, height: 700 };
      updatePosition(id, newPosition);
      updateSize(id, newSize);

      // Minimize and restore
      minimizeWindow(id);
      restoreWindow(id);

      const finalState = useOSStore.getState();
      const window = finalState.windows.find(w => w.id === id)!;

      expect(window.isMinimized).toBe(false);
      expect(window.position).toEqual(newPosition);
      expect(window.size).toEqual(newSize);
    });
  });

  describe('Property 4: maximizeWindow stores prevPosition and prevSize', () => {
    it('should set prevPosition and prevSize when maximizing a window', () => {
      const { openWindow, maximizeWindow } = useOSStore.getState();

      const id = openWindow('tests');
      const before = useOSStore.getState().windows.find(w => w.id === id)!;
      const expectedPosition = { ...before.position };
      const expectedSize = { ...before.size };

      maximizeWindow(id);

      const win = useOSStore.getState().windows.find(w => w.id === id)!;
      expect(win.isMaximized).toBe(true);
      expect(win.prevPosition).not.toBeNull();
      expect(win.prevPosition).not.toBeUndefined();
      expect(win.prevSize).not.toBeNull();
      expect(win.prevSize).not.toBeUndefined();
      expect(win.prevPosition).toEqual(expectedPosition);
      expect(win.prevSize).toEqual(expectedSize);
    });

    it('should hold the invariant for any window type when maximized', () => {
      const { openWindow, maximizeWindow } = useOSStore.getState();
      const appTypes: AppType[] = ['tests', 'results', 'analytics', 'question-bank', 'test-manager'];

      for (const appType of appTypes) {
        useOSStore.setState({ windows: [], focusedWindowId: null, nextZIndex: 100 });
        const id = openWindow(appType);
        maximizeWindow(id);

        const win = useOSStore.getState().windows.find(w => w.id === id)!;
        expect(win.isMaximized).toBe(true);
        expect(win.prevPosition).toBeDefined();
        expect(win.prevSize).toBeDefined();
      }
    });

    it('should preserve prevPosition and prevSize through unmaximize and re-maximize', () => {
      const { openWindow, maximizeWindow, unmaximizeWindow, updatePosition, updateSize } = useOSStore.getState();

      const id = openWindow('results');

      // First maximize
      maximizeWindow(id);
      let win = useOSStore.getState().windows.find(w => w.id === id)!;
      expect(win.prevPosition).toBeDefined();
      expect(win.prevSize).toBeDefined();

      // Restore, move window, then maximize again
      unmaximizeWindow(id);
      updatePosition(id, { x: 300, y: 200 });
      updateSize(id, { width: 850, height: 650 });

      maximizeWindow(id);
      win = useOSStore.getState().windows.find(w => w.id === id)!;
      expect(win.isMaximized).toBe(true);
      expect(win.prevPosition).toEqual({ x: 300, y: 200 });
      expect(win.prevSize).toEqual({ width: 850, height: 650 });
    });
  });
});
