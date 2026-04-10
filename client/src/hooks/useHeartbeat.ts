import { useEffect } from 'react';
import api from '../lib/axios';

export function useHeartbeat(attemptId: string | null, active: boolean) {
  useEffect(() => {
    if (!active || !attemptId) return;

    const id = setInterval(() => {
      api.post(`/attempts/${attemptId}/heartbeat`).catch(() => {});
    }, 30_000);

    return () => clearInterval(id);
  }, [attemptId, active]);
}
