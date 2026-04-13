import { useEffect, useRef } from 'react';
import api from '../lib/axios';

interface Options {
  attemptId: string | null;
  active: boolean;
  onEvent: (msg: string) => void;
  onTabSwitchCount?: (count: number) => void;
}

export function useIntegrityListeners({ attemptId, active, onEvent, onTabSwitchCount }: Options) {
  const lastEvent = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!active || !attemptId) return;

    function report(key: string, eventName: string, points: number) {
      const now = Date.now();
      // Reduced debounce for more accurate count, but still prevent spam
      if ((lastEvent.current[key] ?? 0) + 500 > now) return;
      lastEvent.current[key] = now;

      api.patch(`/attempts/${attemptId}/integrity`, { event: eventName })
        .then(r => {
          const newCount = r.data?.[eventName === 'tab_switch' ? 'tab_switches' : 'focus_lost_count'];
          if (eventName === 'tab_switch') {
             onEvent(`Tab switch detected — integrity deduction applied`);
             if (onTabSwitchCount) onTabSwitchCount(newCount);
          } else {
             onEvent(`Window focus lost — recorded`);
          }
        })
        .catch(() => {});
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        report('tab_switch', 'tab_switch', 30);
      }
    }

    function onBlur() {
      report('focus_lost', 'focus_lost', 10);
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
    };
  }, [attemptId, active, onTabSwitchCount, onEvent]);
}
