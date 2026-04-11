import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FontSize = 'small' | 'medium' | 'large';

const FONT_SIZE_MAP: Record<FontSize, string> = {
  small:  '13px',
  medium: '15px',
  large:  '17px',
};

interface OSSettings {
  fontSize: FontSize;
  dockAutohide: boolean;
  setFontSize: (size: FontSize) => void;
  toggleDockAutohide: () => void;
}

export const useOSSettings = create<OSSettings>()(
  persist(
    (set) => ({
      fontSize: 'medium',
      dockAutohide: false,
      setFontSize: (size) => {
        document.documentElement.style.fontSize = FONT_SIZE_MAP[size];
        set({ fontSize: size });
      },
      toggleDockAutohide: () => set(s => ({ dockAutohide: !s.dockAutohide })),
    }),
    { name: 'os-settings' }
  )
);

// Apply persisted font size on load
export function applyPersistedSettings() {
  const raw = localStorage.getItem('os-settings');
  if (raw) {
    try {
      const { state } = JSON.parse(raw);
      if (state?.fontSize) {
        document.documentElement.style.fontSize = FONT_SIZE_MAP[state.fontSize as FontSize];
      }
    } catch {}
  }
}
