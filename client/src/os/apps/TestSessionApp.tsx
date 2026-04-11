import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../lib/axios';
import { useOSStore } from '../store/useOSStore';
import { useHeartbeat } from '../../hooks/useHeartbeat';
import { useIntegrityListeners } from '../../hooks/useIntegrityListeners';
import QuestionNavigator from '../../components/test/QuestionNavigator';
import MCQQuestion from '../../components/test/MCQQuestion';
import SubmitConfirmModal from '../../components/test/SubmitConfirmModal';
import VSCodeLayout from '../components/VSCodeLayout';

type SessionPhase = 'start-screen' | 'active' | 'evaluating' | 'done';

const RULES = [
  'Close all other browser tabs before starting.',
  'Do not switch windows or applications during the test.',
  'Ensure you have a stable internet connection.',
  'The test will auto-submit when the timer runs out.',
  'Tab switches and focus loss are recorded and affect your integrity score.',
];

function formatTime(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface TestSessionAppProps {
  testId?: string;
  attemptId?: string;
}

export default function TestSessionApp({ testId, attemptId: initialAttemptId }: TestSessionAppProps) {
  const { openWindow, closeWindow, lockWindow, unlockWindow } = useOSStore();
  const [windowId, setWindowId] = useState<string | null>(null);

  const [phase, setPhase] = useState<SessionPhase>('start-screen');
  const [test, setTest] = useState<any>(null);
  const [attempt, setAttempt] = useState<any>(null);
  const [attemptId, setAttemptId] = useState<string | null>(initialAttemptId || null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [runsRemaining, setRunsRemaining] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [testSettings, setTestSettings] = useState<any>({});

  // Track answered + review state
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());
  const [reviewIds, setReviewIds] = useState<Set<string>>(new Set());

  // Elapsed minutes for unlock logic
  const startedAtRef = useRef<Date | null>(null);
  const [elapsedMins, setElapsedMins] = useState(0);

  // Get window ID from context (we'll need to create a context provider)
  useEffect(() => {
    // Find our window ID
    const windows = useOSStore.getState().windows;
    const myWindow = windows.find(w => 
      w.appType === 'test-session' && 
      (w.appProps?.attemptId === initialAttemptId || w.appProps?.testId === testId)
    );
    if (myWindow) {
      setWindowId(myWindow.id);
    }
  }, [initialAttemptId, testId]);

  // Load test/attempt data
  useEffect(() => {
    if (initialAttemptId) {
      // Resume path
      loadAttempt(initialAttemptId);
    } else if (testId) {
      // New attempt path - show start screen
      loadTest(testId);
    }
  }, [initialAttemptId, testId]);

  async function loadTest(tid: string) {
    try {
      const { data } = await api.get('/tests/available');
      const found = (data.tests ?? []).find((t: any) => t.id === tid);
      if (!found) {
        setError('Test not found or not available.');
      } else {
        // Check if already attempted
        if (found.attempt && ['submitted', 'auto_submitted'].includes(found.attempt.status)) {
          // Already submitted - open results and close this window
          openWindow('results', { attemptId: found.attempt.id });
          if (windowId) closeWindow(windowId);
          return;
        }
        if (found.attempt?.status === 'in_progress') {
          // Resume existing attempt
          loadAttempt(found.attempt.id);
          return;
        }
        setTest(found);
        setPhase('start-screen');
      }
    } catch (err) {
      setError('Failed to load test.');
    } finally {
      setLoading(false);
    }
  }

  async function loadAttempt(aid: string) {
    try {
      const { data } = await api.get(`/attempts/${aid}`);

      if (['submitted', 'auto_submitted'].includes(data.status)) {
        // Already submitted - open results and close this window
        openWindow('results', { attemptId: aid });
        if (windowId) closeWindow(windowId);
        return;
      }

      setAttempt(data);
      setAttemptId(aid);
      setTimeLeft(data.time_remaining_seconds ?? 0);
      setRunsRemaining(data.runs_remaining ?? 10);
      startedAtRef.current = new Date(data.started_at);

      // Load questions
      const qRes = await api.get(`/attempts/${aid}/questions`);
      const qs = qRes.data.questions ?? [];
      setQuestions(qs);

      // Pre-populate answered set
      const answered = new Set<string>(
        qs.filter((q: any) => {
          const r = q.saved_response;
          if (!r) return false;
          if (r.selected_option_ids?.length > 0) return true;
          if (r.submitted_code?.trim()) return true;
          return false;
        }).map((q: any) => q.id)
      );
      setAnsweredIds(answered);

      setPhase('active');
      
      // Lock window after attempt loaded — find window ID if not set yet
      const wid = windowId ?? useOSStore.getState().windows.find(w =>
        w.appType === 'test-session' &&
        (w.appProps?.attemptId === aid || w.appProps?.testId === testId)
      )?.id ?? null;
      if (wid) {
        setWindowId(wid);
        lockWindow(wid);
      }
    } catch (err) {
      setError('Could not load attempt. It may have expired or been submitted.');
    } finally {
      setLoading(false);
    }
  }

  async function handleStart() {
    if (!agreed || !testId) return;
    setStarting(true);
    setError('');
    try {
      const { data } = await api.post('/attempts/start', { test_id: testId });
      setAttemptId(data.attempt_id);
      await loadAttempt(data.attempt_id);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Failed to start test');
      setStarting(false);
    }
  }

  // Countdown timer
  useEffect(() => {
    if (phase !== 'active' || timeLeft <= 0) return;
    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(id);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
      // Update elapsed minutes
      if (startedAtRef.current) {
        setElapsedMins((Date.now() - startedAtRef.current.getTime()) / 60000);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase, timeLeft]);

  // Enforce test settings (copy-paste, right-click) during active test
  useEffect(() => {
    if (phase !== 'active') return;

    const handlers: Array<[string, EventListener]> = [];

    if (!testSettings.allow_copy) {
      const h = (e: Event) => e.preventDefault();
      document.addEventListener('copy', h);
      handlers.push(['copy', h]);
    }
    if (!testSettings.allow_paste) {
      const h = (e: Event) => e.preventDefault();
      document.addEventListener('paste', h);
      handlers.push(['paste', h]);
    }
    if (!testSettings.allow_right_click) {
      const h = (e: Event) => e.preventDefault();
      document.addEventListener('contextmenu', h);
      handlers.push(['contextmenu', h]);
    }

    return () => {
      handlers.forEach(([event, handler]) => document.removeEventListener(event, handler));
    };
  }, [phase, testSettings]);

  // Load test settings when test is known
  useEffect(() => {
    const tid = testId || test?.id;
    if (!tid) return;
    api.get(`/tests/${tid}/settings`).then(r => setTestSettings(r.data.settings ?? {})).catch(() => {});
  }, [testId, test?.id]);
  // Heartbeat + integrity
  useHeartbeat(attemptId, phase === 'active');
  useIntegrityListeners({
    attemptId,
    active: phase === 'active',
    onEvent: (msg) => {
      console.warn('Integrity event:', msg);
      // Check if tab_switch count reached 3
      if (msg.includes('Tab switch')) {
        checkIntegrityViolation();
      }
    },
  });

  async function checkIntegrityViolation() {
    if (!attemptId) return;
    const maxSwitches = testSettings.max_tab_switches ?? 3;
    try {
      const { data } = await api.get(`/attempts/${attemptId}`);
      if (data.tab_switches >= maxSwitches && testSettings.auto_submit_on_tab_limit !== false) {
        await handleSubmit(true, 'integrity_violation');
      }
    } catch (err) {
      console.error('Failed to check integrity:', err);
    }
  }

  async function handleSubmit(auto = false, reason?: string) {
    if (submitting || !attemptId) return;
    setSubmitting(true);
    setShowConfirm(false);
    setPhase('evaluating');
    setSubmitError('');

    try {
      const payload: any = { auto };
      if (reason) payload.auto_submit_reason = reason;

      await api.post(`/attempts/${attemptId}/submit`, payload);

      // Unlock window
      if (windowId) {
        unlockWindow(windowId);
      }

      // Open results and close this window
      openWindow('results', { attemptId });
      if (windowId) {
        closeWindow(windowId);
      }
    } catch (e: any) {
      setSubmitError(e.response?.data?.error ?? 'Submission failed. Please try again.');
      setPhase('active');
      setSubmitting(false);
    }
  }

  function handleAutoSubmit() {
    handleSubmit(true);
  }

  const onAnswered = useCallback((qid: string, answered: boolean) => {
    setAnsweredIds(prev => {
      const next = new Set(prev);
      answered ? next.add(qid) : next.delete(qid);
      return next;
    });
  }, []);

  const onToggleReview = useCallback((qid: string) => {
    setReviewIds(prev => {
      const next = new Set(prev);
      next.has(qid) ? next.delete(qid) : next.add(qid);
      return next;
    });
  }, []);

  // Timer color
  const timerColor = timeLeft < 300 ? '#f87171' : timeLeft < 600 ? '#facc15' : '#4ade80';
  const currentQ = questions[currentIdx];

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
            Loading test session...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="glass p-10 text-center max-w-md">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => windowId && closeWindow(windowId)}
            className="text-sm underline"
            style={{ color: 'rgb(var(--accent))' }}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Start screen
  if (phase === 'start-screen' && test) {
    return (
      <div className="h-full overflow-auto flex items-center justify-center p-8">
        <div className="w-full max-w-lg space-y-6">
          {/* Test info */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              {test.subject && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: 'rgb(var(--accent))' }}
                >
                  {test.subject}
                </span>
              )}
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgb(var(--text-secondary))' }}
              >
                {test.year} · Div {test.division}
              </span>
            </div>
            <h1 className="text-2xl font-bold mt-2" style={{ color: 'rgb(var(--text-primary))' }}>
              {test.title}
            </h1>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Duration', value: `${test.duration_mins} min` },
              { label: 'Questions', value: test.questions_per_attempt ?? '—' },
              { label: 'Total Marks', value: test.total_marks ?? '—' },
            ].map(s => (
              <div
                key={s.label}
                className="rounded-xl p-3 text-center"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}
              >
                <p className="text-lg font-bold" style={{ color: 'rgb(var(--accent))' }}>
                  {s.value}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-secondary))' }}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          {/* Rules */}
          <div
            className="rounded-xl p-4 space-y-2"
            style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-wide mb-3"
              style={{ color: 'rgb(var(--text-secondary))' }}
            >
              Rules & Guidelines
            </p>
            {RULES.map((rule, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-xs mt-0.5 shrink-0" style={{ color: '#4ade80' }}>
                  ✓
                </span>
                <p className="text-sm" style={{ color: 'rgb(var(--text-primary))' }}>
                  {rule}
                </p>
              </div>
            ))}
          </div>

          {/* Agreement */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              className="mt-0.5 accent-indigo-500 shrink-0"
            />
            <span className="text-sm" style={{ color: 'rgb(var(--text-primary))' }}>
              I understand and agree to the integrity policy. I will not switch tabs, share answers, or use
              external help.
            </span>
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

          {/* Begin button */}
          <button
            onClick={handleStart}
            disabled={!agreed || starting}
            className="w-full py-3 rounded-xl font-semibold text-white text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ backgroundColor: 'rgb(var(--accent))' }}
          >
            {starting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Starting...
              </>
            ) : (
              'Begin Test'
            )}
          </button>
        </div>
      </div>
    );
  }

  // Active test session
  if (phase === 'active' || phase === 'evaluating') {
    return (
      <div className="h-full flex flex-col">
        {/* Top bar with timer and submit */}
        <div
          className="flex items-center justify-between px-6 py-3 border-b"
          style={{ borderColor: 'var(--glass-border)' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
              {attempt?.test_title || test?.title}
            </span>
          </div>

          {/* Timer */}
          <div
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl"
            style={{ backgroundColor: `${timerColor}15`, border: `1px solid ${timerColor}40` }}
          >
            <span className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
              Time Left
            </span>
            <span className="font-mono font-bold text-base tabular-nums" style={{ color: timerColor }}>
              {formatTime(timeLeft)}
            </span>
          </div>

          <button
            disabled={submitting || phase === 'evaluating'}
            onClick={() => setShowConfirm(true)}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: 'rgb(var(--accent))' }}
          >
            {submitting ? 'Submitting...' : 'Submit Test'}
          </button>
        </div>

        {/* Body: sidebar + main */}
        <div className="flex flex-1 min-h-0">
          {/* Question navigator */}
          <QuestionNavigator
            questions={questions}
            currentIdx={currentIdx}
            answeredIds={answeredIds}
            reviewIds={reviewIds}
            elapsedMinutes={elapsedMins}
            onSelect={setCurrentIdx}
          />

          {/* Main question area */}
          <main className="flex-1 min-h-0 overflow-hidden relative">
            {!currentQ ? (
              <div className="h-full flex items-center justify-center">
                <div className="glass p-10 text-center">
                  <p style={{ color: 'rgb(var(--text-secondary))' }}>No questions available.</p>
                </div>
              </div>
            ) : elapsedMins < (currentQ.unlock_at_minutes ?? 0) ? (
              <div className="h-full flex items-center justify-center p-8">
                <div className="glass p-12 text-center">
                  <p className="text-4xl mb-4">🔒</p>
                  <p className="text-lg font-semibold mb-2" style={{ color: 'rgb(var(--text-primary))' }}>Question Locked</p>
                  <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                    Unlocks at {currentQ.unlock_at_minutes} minutes into the test.
                  </p>
                </div>
              </div>
            ) : currentQ.type === 'debugging' ? (
              // Debugging questions get full height — no scroll wrapper
              <div className="h-full flex flex-col">
                <VSCodeLayout
                  key={currentQ.id}
                  question={currentQ}
                  attemptId={attemptId!}
                  questionNumber={currentIdx + 1}
                  initialCode={currentQ.saved_response?.submitted_code || currentQ.buggy_code}
                  initialRunsRemaining={runsRemaining}
                  sessionPhase={phase}
                  onCodeChange={() => {}}
                  onAnswered={onAnswered}
                />
                {/* Nav buttons for debug questions */}
                <div className="flex items-center justify-between px-6 py-3 border-t shrink-0"
                  style={{ borderColor: 'var(--glass-border)', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                  <button disabled={currentIdx === 0} onClick={() => setCurrentIdx(i => i - 1)}
                    className="px-4 py-1.5 rounded-lg text-sm disabled:opacity-30"
                    style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
                    ← Previous
                  </button>
                  <span className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>{currentIdx + 1} / {questions.length}</span>
                  <button disabled={currentIdx === questions.length - 1} onClick={() => setCurrentIdx(i => i + 1)}
                    className="px-4 py-1.5 rounded-lg text-sm disabled:opacity-30"
                    style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
                    Next →
                  </button>
                </div>
              </div>
            ) : (
              // MCQ questions scroll normally
              <div className="h-full overflow-y-auto p-8">
                <div className="max-w-3xl mx-auto space-y-6">
                  {(currentQ.type === 'mcq_single' || currentQ.type === 'mcq_multi') && (
                    <MCQQuestion
                      key={currentQ.id}
                      question={currentQ}
                      attemptId={attemptId!}
                      questionNumber={currentIdx + 1}
                      isMarkedForReview={reviewIds.has(currentQ.id)}
                      onAnswered={onAnswered}
                      onToggleReview={onToggleReview}
                    />
                  )}
                  <div className="flex items-center justify-between">
                    <button disabled={currentIdx === 0} onClick={() => setCurrentIdx(i => i - 1)}
                      className="px-5 py-2 rounded-lg text-sm disabled:opacity-30"
                      style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
                      ← Previous
                    </button>
                    <span className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>{currentIdx + 1} / {questions.length}</span>
                    <button disabled={currentIdx === questions.length - 1} onClick={() => setCurrentIdx(i => i + 1)}
                      className="px-5 py-2 rounded-lg text-sm disabled:opacity-30"
                      style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
                      Next →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Submit confirmation modal */}
        {showConfirm && (
          <SubmitConfirmModal
            answeredCount={answeredIds.size}
            totalCount={questions.length}
            onConfirm={() => handleSubmit(false)}
            onCancel={() => setShowConfirm(false)}
          />
        )}

        {/* Evaluating screen */}
        {phase === 'evaluating' && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          >
            <div className="text-center">
              <span className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin inline-block mb-4" />
              <p className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
                Evaluating your test...
              </p>
              {submitError && (
                <p className="text-sm text-red-400 mt-2">{submitError}</p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
