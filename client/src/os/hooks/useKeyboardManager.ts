import { useEffect } from 'react';
import { useOSStore } from '../store/useOSStore';

/**
 * Global Keyboard Manager for the OS Shell.
 * Handles Alt+Tab for window switching and focus management.
 */
export function useKeyboardManager() {
  const { isSwitcherOpen, setSwitcherOpen } = useOSStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Switcher on Alt + Tab
      if (e.altKey && e.key === 'Tab') {
        e.preventDefault();
        setSwitcherOpen(true);
      }

      // Close Switcher on Escape
      if (e.key === 'Escape' && isSwitcherOpen) {
        setSwitcherOpen(false);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // If Alt is released while switcher is open, close it
      if (e.key === 'Alt' && isSwitcherOpen) {
        setSwitcherOpen(false);
        // In a full implementation, we would focus the currently highlighted window here.
        // For now, it just closes the overlay.
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSwitcherOpen, setSwitcherOpen]);
}
