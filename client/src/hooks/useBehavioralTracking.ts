import { useCallback, useEffect, useRef, useState } from 'react';
import type * as Monaco from 'monaco-editor';

export interface BehavioralMeta {
  time_to_first_keystroke: number | null; // ms
  backspace_count: number;
  paste_events: number;
  edit_count: number;
  wpm_consistency: number;
  idle_periods: { start: string; duration_seconds: number }[];
  test_runs_before_submit: number;
}

const IDLE_THRESHOLD_MS  = 180_000; // 3 minutes
const EDIT_DEBOUNCE_MS   = 2_000;
const WPM_INTERVAL_MS    = 10_000;

export function useBehavioralTracking(questionOpenTime: number) {
  const metaRef = useRef<BehavioralMeta>({
    time_to_first_keystroke: null,
    backspace_count:         0,
    paste_events:            0,
    edit_count:              0,
    wpm_consistency:         0,
    idle_periods:            [],
    test_runs_before_submit: 0,
  });

  const [meta, setMeta] = useState<BehavioralMeta>({ ...metaRef.current });

  const lastKeystrokeRef  = useRef<number>(Date.now());
  const editDebounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const charCountRef      = useRef<number>(0);
  const wpmSamplesRef     = useRef<number[]>([]);
  const idleCheckRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleStartRef      = useRef<number | null>(null);

  function flush() {
    setMeta({ ...metaRef.current });
  }

  // WPM rolling average — sampled every 10s
  useEffect(() => {
    const id = setInterval(() => {
      const chars = charCountRef.current;
      charCountRef.current = 0;
      const wpm = (chars / 5) * 6; // chars/5 = words, *6 = per minute (10s window)
      wpmSamplesRef.current.push(wpm);
      if (wpmSamplesRef.current.length > 20) wpmSamplesRef.current.shift();
      const avg = wpmSamplesRef.current.reduce((a, b) => a + b, 0) / wpmSamplesRef.current.length;
      metaRef.current.wpm_consistency = Math.round(avg);
      flush();
    }, WPM_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Idle period detection
  useEffect(() => {
    idleCheckRef.current = setInterval(() => {
      const now = Date.now();
      const sinceLastKey = now - lastKeystrokeRef.current;

      if (sinceLastKey >= IDLE_THRESHOLD_MS) {
        if (idleStartRef.current === null) {
          idleStartRef.current = lastKeystrokeRef.current;
        }
      } else {
        if (idleStartRef.current !== null) {
          const duration = Math.round((now - idleStartRef.current) / 1000);
          metaRef.current.idle_periods.push({
            start:            new Date(idleStartRef.current).toISOString(),
            duration_seconds: duration,
          });
          idleStartRef.current = null;
          flush();
        }
      }
    }, 10_000);
    return () => { if (idleCheckRef.current) clearInterval(idleCheckRef.current); };
  }, []);

  // Called by Monaco onKeyDown
  const onKeyDown = useCallback((e: Monaco.IKeyboardEvent) => {
    const now = Date.now();
    lastKeystrokeRef.current = now;

    // First keystroke
    if (metaRef.current.time_to_first_keystroke === null) {
      metaRef.current.time_to_first_keystroke = now - questionOpenTime;
    }

    // Backspace
    if (e.keyCode === 1 /* Backspace in Monaco KeyCode */) {
      metaRef.current.backspace_count++;
    }

    charCountRef.current++;

    // Edit session debounce
    if (editDebounceRef.current) clearTimeout(editDebounceRef.current);
    editDebounceRef.current = setTimeout(() => {
      metaRef.current.edit_count++;
      flush();
    }, EDIT_DEBOUNCE_MS);

    flush();
  }, [questionOpenTime]);

  // Called by Monaco onDidPaste
  const onPaste = useCallback(() => {
    metaRef.current.paste_events++;
    flush();
  }, []);

  // Called when student clicks Run Code
  const onRunCode = useCallback(() => {
    metaRef.current.test_runs_before_submit++;
    flush();
  }, []);

  return { meta, onKeyDown, onPaste, onRunCode, lastIdleWarningRef: lastKeystrokeRef };
}
