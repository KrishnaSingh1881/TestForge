import { useRef, useEffect } from 'react';
import Lenis from 'lenis';

export interface RunResult {
  test_case_id: number;
  passed: boolean;
  input?: string;
  expected?: string;
  actual?: string;
  stderr?: string;
}

interface TerminalProps {
  results: RunResult[];
  runsRemaining: number;
  running: boolean;
  onRun: () => void;
  height: number;
  onHeightChange: (h: number) => void;
  maxHeight: number; // 60% of window height
}

export default function Terminal({
  results,
  runsRemaining,
  running,
  onRun,
  height,
  onHeightChange,
  maxHeight,
}: TerminalProps) {
  const outputRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  // Lenis smooth scroll for output area
  useEffect(() => {
    if (!outputRef.current) return;

    const lenis = new Lenis({
      wrapper: outputRef.current,
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    const rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  // Drag handle logic
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);

      const startY = e.clientY;
      const startHeight = height;

      const onMove = (ev: PointerEvent) => {
        const delta = startY - ev.clientY; // drag up = increase height
        const newHeight = Math.max(100, Math.min(maxHeight, startHeight + delta));
        onHeightChange(newHeight);
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };

    handle.addEventListener('pointerdown', onPointerDown);
    return () => handle.removeEventListener('pointerdown', onPointerDown);
  }, [height, maxHeight, onHeightChange]);

  return (
    <div
      className="flex flex-col"
      style={{
        height: `${height}px`,
        backgroundColor: 'var(--vscode-terminal-bg)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      {/* Drag handle */}
      <div
        ref={handleRef}
        className="h-1 cursor-ns-resize hover:bg-blue-500/30 transition-colors"
        style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
      />

      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.1)' }}
      >
        <span className="text-xs font-semibold tracking-wide" style={{ color: '#cccccc' }}>
          TERMINAL
        </span>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono" style={{ color: '#858585' }}>
            Runs: {runsRemaining > 0 ? `${runsRemaining}` : '0'} remaining
          </span>
          <button
            onClick={onRun}
            disabled={runsRemaining === 0 || running}
            className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: runsRemaining > 0 && !running ? '#4ade80' : 'rgba(255,255,255,0.1)',
              color: runsRemaining > 0 && !running ? '#000' : '#858585',
            }}
          >
            <span>▶</span>
            <span>{running ? 'Running...' : runsRemaining === 0 ? 'No runs left' : 'Run'}</span>
          </button>
        </div>
      </div>

      {/* Output area */}
      <div ref={outputRef} className="flex-1 overflow-auto p-4 font-mono text-sm">
        {results.length === 0 ? (
          <div style={{ color: '#858585' }}>
            <p>$ testforge run solution</p>
            <p className="mt-2">Click "Run" to execute your code against test cases.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p style={{ color: 'var(--vscode-terminal-prompt, #569cd6)' }}>$ testforge run solution</p>
            {results.map((result, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-start gap-2">
                  <span style={{ color: result.passed ? '#4ade80' : '#f87171' }}>
                    {result.passed ? '✓' : '✗'}
                  </span>
                  <div className="flex-1">
                    <p style={{ color: result.passed ? '#4ade80' : '#f87171' }}>
                      Test {result.test_case_id}: {result.passed ? 'passed' : 'failed'}
                    </p>
                    {!result.passed && (
                      <div className="mt-1 text-xs space-y-0.5" style={{ color: '#cccccc' }}>
                        {result.input && <p>Input: {result.input}</p>}
                        {result.expected && <p>Expected: {result.expected}</p>}
                        {result.actual && <p>Actual: {result.actual}</p>}
                        {result.stderr && (
                          <p style={{ color: '#f87171' }}>Error: {result.stderr}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
