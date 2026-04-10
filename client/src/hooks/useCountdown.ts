import { useState, useEffect } from 'react';

// Returns a human-readable countdown string to a target date, or null if past
export function useCountdown(targetDate: string | null): string | null {
  const [display, setDisplay] = useState<string | null>(null);

  useEffect(() => {
    if (!targetDate) return;

    function update() {
      const diff = new Date(targetDate!).getTime() - Date.now();
      if (diff <= 0) { setDisplay(null); return; }

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);

      if (h > 0) setDisplay(`${h}h ${m}m`);
      else if (m > 0) setDisplay(`${m}m ${s}s`);
      else setDisplay(`${s}s`);
    }

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return display;
}
