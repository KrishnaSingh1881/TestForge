import { useEffect, useRef } from 'react';
import api from '../lib/axios';

interface Options {
  attemptId: string | null;
  active: boolean;
  onEvent: (msg: string) => void;
}

export function useIntegrityListeners({ attemptId, active, onEvent }: Options) {
  // Debounce: ignore rapid duplicate events within 2s
  const lastEvent = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!active || !attemptId) return;

    function debounced(key: string, fn: () => void) {
      const now = Date.now();
      if ((lastEvent.current[key] ?? 0) + 2000 > now) return;
      lastEvent.current[key] = now;
      fn();
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        debounced('tab_switch', () => {
          api.patch(`/attempts/${attemptId}/integrity`, { event: 'tab_switch' }).catch(() => {});
          onEvent('Tab switch detected — this has been recorded');
        });
      }
    }

    function onBlur() {
      debounced('focus_lost', () => {
        api.patch(`/attempts/${attemptId}/integrity`, { event: 'focus_lost' }).catch(() => {});
        onEvent('Window focus lost — this has been recorded');
      });
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
    };
  }, [attemptId, active]);
}
