import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FontSize = 'small' | 'medium' | 'large' | 'xl';

interface OSSettings {
  fontSize: FontSize;
  dockAutohide: boolean;
  setFontSize: (size: FontSize) => void;
  toggleDockAutohide: () => void;
}

function applyFont(size: FontSize) {
  document.documentElement.setAttribute('data-font', size);
}

export const useOSSettings = create<OSSettings>()(
  persist(
    (set) => ({
      fontSize: 'medium',
      dockAutohide: false,
      setFontSize: (size) => {
        applyFont(size);
        set({ fontSize: size });
      },
      toggleDockAutohide: () => set(s => ({ dockAutohide: !s.dockAutohide })),
    }),
    { name: 'os-settings' }
  )
);

export function applyPersistedSettings() {
  try {
    const raw = localStorage.getItem('os-settings');
    if (raw) {
      const { state } = JSON.parse(raw);
      if (state?.fontSize) applyFont(state.fontSize as FontSize);
    }
  } catch {}
}
