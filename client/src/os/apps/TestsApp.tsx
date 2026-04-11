import { useEffect, useState, useRef } from 'react';
import api from '../../lib/axios';
import { useOSStore } from '../store/useOSStore';
import { useCountdown } from '../../hooks/useCountdown';
import { useAuth } from '../../context/AuthContext';
import Lenis from 'lenis';

interface Attempt {
  id: string;
  status: string;
}

interface Test {
  id: string;
  title: string;
  subject: string;
  year: string;
  division: string;
  duration_mins: number;
  start_time: string;
  end_time: string;
  questions_per_attempt: number;
  total_marks: number;
  attempt: Attempt | null;
}

function TestCard({ test }: { test: Test }) {
  const openWindow = useOSStore(s => s.openWindow);
  const now = Date.now();
  const started = new Date(test.start_time).getTime() <= now;
  const ended = new Date(test.end_time).getTime() <= now;
  const countdown = useCountdown(!started ? test.start_time : null);

  const attempted = !!test.attempt;
  const submitted = test.attempt?.status === 'submitted' || test.attempt?.status === 'auto_submitted';

  const handleStart = () => {
    openWindow('test-session', { testId: test.id });
  };

  const handleResume = () => {
    openWindow('test-session', { testId: test.id, attemptId: test.attempt!.id });
  };

  const handleViewResults = () => {
    openWindow('results', { attemptId: test.attempt!.id });
  };

  return (
    <div className="glass p-5 flex flex-col gap-4 transition-transform hover:-translate-y-0.5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold leading-snug" style={{ color: 'rgb(var(--text-primary))' }}>
          {test.title}
        </h3>
        {test.subject && (
          <span
            className="text-xs px-2 py-0.5 rounded-full shrink-0 font-medium"
            style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: 'rgb(var(--accent))' }}
          >
            {test.subject}
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-2">
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgb(var(--text-secondary))' }}
        >
          {test.year} · Div {test.division}
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgb(var(--text-secondary))' }}
        >
          ⏱ {test.duration_mins} min
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgb(var(--text-secondary))' }}
        >
          {test.questions_per_attempt} questions
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgb(var(--text-secondary))' }}
        >
          {test.total_marks} marks
        </span>
      </div>

      {/* CTA */}
      <div className="mt-auto">
        {ended ? (
          <div className="text-center py-2 rounded-lg text-sm"
            style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
            Test Ended
          </div>
        ) : test.status === 'draft' ? (
          <div className="text-center py-2 rounded-lg text-sm"
            style={{ backgroundColor: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', color: '#facc15' }}>
            ⏳ Not started yet — waiting for teacher
          </div>
        ) : submitted ? (
          <button
            onClick={handleViewResults}
            className="block w-full text-center py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              backgroundColor: 'rgba(74,222,128,0.12)',
              color: '#4ade80',
              border: '1px solid rgba(74,222,128,0.3)',
            }}
          >
            View Results
          </button>
        ) : attempted ? (
          <button
            onClick={handleResume}
            className="block w-full text-center py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              backgroundColor: 'rgba(234,179,8,0.12)',
              color: '#facc15',
              border: '1px solid rgba(234,179,8,0.3)',
            }}
          >
            Resume Test
          </button>
        ) : started ? (
          <button
            onClick={handleStart}
            className="block w-full text-center py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'rgb(var(--accent))' }}
          >
            Start Test
          </button>
        ) : (
          <div
            className="text-center py-2 rounded-lg text-sm"
            style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--glass-border)',
              color: 'rgb(var(--text-secondary))',
            }}
          >
            Starts in{' '}
            <span className="font-mono font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
              {countdown}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TestsApp() {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Fetch tests and poll every 60 seconds
  useEffect(() => {
    const fetchTests = () => {
      api
        .get('/tests/available')
        .then(r => setTests(r.data.tests ?? []))
        .catch(err => console.error('Failed to fetch tests:', err))
        .finally(() => setLoading(false));
    };

    fetchTests();
    const interval = setInterval(fetchTests, 60_000);

    return () => clearInterval(interval);
  }, []);

  // Lenis smooth scroll
  useEffect(() => {
    if (!containerRef.current) return;

    const lenis = new Lenis({
      wrapper: containerRef.current,
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

  return (
    <div ref={containerRef} className="h-full overflow-auto">
      <div className="p-8 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
              Available Tests
            </h1>
            <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>
              Active tests assigned to your year and division.
            </p>
          </div>
          {user && (
            <div className="flex gap-2 flex-wrap">
              {user.year && (
                <span className="text-xs px-3 py-1.5 rounded-full font-medium"
                  style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: 'rgb(var(--accent))' }}>
                  {user.year}
                </span>
              )}
              {user.division && (
                <span className="text-xs px-3 py-1.5 rounded-full font-medium"
                  style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: 'rgb(var(--accent))' }}>
                  Div {user.division}
                </span>
              )}
              {user.subject && (
                <span className="text-xs px-3 py-1.5 rounded-full font-medium"
                  style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgb(var(--text-secondary))' }}>
                  {user.subject}
                </span>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
            Loading...
          </p>
        ) : tests.length === 0 ? (
          <div className="glass p-12 text-center">
            <p className="text-lg mb-1" style={{ color: 'rgb(var(--text-primary))' }}>
              No tests available
            </p>
            <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
              Check back later — your teacher will publish tests here.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {tests.map(t => (
              <TestCard key={t.id} test={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
