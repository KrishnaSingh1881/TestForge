import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../lib/axios';
import { useOSStore } from '../store/useOSStore';
import { useHeartbeat } from '../../hooks/useHeartbeat';
import { useIntegrityListeners } from '../../hooks/useIntegrityListeners';
import QuestionNavigator from '../../components/test/QuestionNavigator';
import MCQQuestion from '../../components/test/MCQQuestion';
import SubmitConfirmModal from '../../components/test/SubmitConfirmModal';
import VSCodeLayout from '../components/VSCodeLayout';

type SessionPhase = 'start-screen' | 'active' | 'evaluating' | 'done' | 'integrity-failed';

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

export default function TestSessionApp({ id: windowId, testId, attemptId: initialAttemptId }: TestSessionAppProps & { id: string }) {
  const { openWindow, closeWindow, lockWindow, unlockWindow } = useOSStore();

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

  // Integrity warning toast
  const [integrityToast, setIntegrityToast] = useState<string>('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track answered + review state
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());
  const [reviewIds, setReviewIds] = useState<Set<string>>(new Set());

  // Elapsed minutes for unlock logic
  const startedAtRef = useRef<Date | null>(null);
  const [elapsedMins, setElapsedMins] = useState(0);

  // Integrity toast helper — defined early so effects can capture it
  const showToast = useCallback((msg: string) => {
    setIntegrityToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setIntegrityToast(''), 4000);
  }, []);

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
      
      if (windowId) {
        lockWindow(windowId);
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

  // Enforce test settings (copy-paste, right-click, keyboard shortcuts) during active test
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

    // Block keyboard shortcuts: Ctrl+C (copy) and Ctrl+V (paste)
    const keyHandler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 'c' && !testSettings.allow_copy) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (ctrl && e.key === 'v' && !testSettings.allow_paste) {
        e.preventDefault();
        e.stopPropagation();
        showToast('⛔ Paste is disabled during this test');
      }
      // Block inspect / dev tools
      if (e.key === 'F12') e.preventDefault();
      if (ctrl && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) e.preventDefault();
      if (ctrl && e.key === 'u') e.preventDefault();
    };
    document.addEventListener('keydown', keyHandler, true);
    handlers.push(['keydown', keyHandler as EventListener]);

    return () => {
      handlers.forEach(([event, handler]) => document.removeEventListener(event, handler, true as any));
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
      showToast(msg.includes('Tab switch')
        ? `⚠️ Tab switch detected — ${(testSettings.max_tab_switches ?? 3)} max allowed`
        : msg
      );
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

      if (reason === 'integrity_violation') {
        setPhase('integrity-failed');
      } else {
        openWindow('results', { attemptId });
        if (windowId) closeWindow(windowId);
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
        <div className="glass shadow-2xl p-10 text-center max-w-md border-red-500/20">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6 border border-red-500/20">
            <FiAlertTriangle className="text-3xl text-red-400" />
          </div>
          <p className="text-red-400 font-black uppercase tracking-widest mb-4">{error}</p>
          <button
            onClick={() => windowId && closeWindow(windowId)}
            className="px-6 py-2 rounded-xl bg-black/5 text-secondary font-bold hover:bg-black/10 transition-all"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Start screen
  if (phase === 'start-screen' && test) {
    return (
      <div className="h-full overflow-auto flex items-center justify-center p-8 custom-scrollbar">
        <div className="w-full max-w-xl space-y-8 animate-in fade-in zoom-in duration-700">
          {/* Test info */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 mb-4 p-1.5 px-3 bg-black/5 rounded-full border border-white/5">
              {test.subject && (
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                  {test.subject}
                </span>
              )}
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-[10px] font-black uppercase tracking-widest text-secondary opacity-60">
                {test.year} · Div {test.division}
              </span>
            </div>
            <h1 className="text-4xl font-black text-primary tracking-tight leading-none uppercase">
              {test.title}
            </h1>
            <p className="text-xs text-secondary font-bold uppercase tracking-[0.3em] mt-3 opacity-40">Verification Phase 🛡️</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Time Limit', value: `${test.duration_mins}m`, icon: FiClock },
              { label: 'Questions', value: test.questions_per_attempt ?? '—', icon: FiBox },
              { label: 'Total Marks', value: test.total_marks ?? '—', icon: FiPlus },
            ].map(s => (
              <div key={s.label} className="glass no-shadow rounded-2xl p-4 text-center border-white/5 group hover:border-indigo-500/30 transition-all duration-500">
                <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center mx-auto mb-2 text-indigo-400 group-hover:scale-110 transition-transform">
                  <s.icon />
                </div>
                <p className="text-lg font-black text-primary">
                  {s.value}
                </p>
                <p className="text-[9px] font-black uppercase tracking-widest text-secondary opacity-40 mt-0.5">
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          {/* Rules Section */}
          <div className="glass no-shadow rounded-3xl p-8 space-y-4 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary opacity-40 mb-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/5" />
              Guidelines for Conduct
              <span className="h-px flex-1 bg-white/5" />
            </p>
            <div className="grid gap-3">
              {RULES.map((rule, i) => (
                <div key={i} className="flex items-start gap-4 p-3 rounded-2xl bg-black/5 border border-white/5">
                  <span className="text-xs mt-0.5 shrink-0 text-indigo-400 font-bold">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="text-xs font-bold text-primary opacity-80 leading-relaxed uppercase tracking-tight">
                    {rule}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="space-y-6">
              <label className="group flex items-start gap-4 cursor-pointer p-5 rounded-3xl bg-black/5 border border-white/5 hover:bg-black/10 transition-all">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  className="mt-1 w-5 h-5 accent-indigo-500 shrink-0 rounded-lg"
                />
                <span className="text-xs font-bold text-primary leading-relaxed uppercase tracking-tight opacity-60 group-hover:opacity-100 transition-opacity">
                  I solemnly affirm that I will maintain absolute academic integrity. 
                  I understand that tab switching or any unauthorized act will result in <span className="text-red-400 font-black">IMMEDIATE TERMINATION</span> of this session.
                </span>
              </label>

              {error && <p className="text-xs font-black uppercase tracking-widest text-red-400 bg-red-400/10 p-4 rounded-xl border border-red-400/20 text-center">{error}</p>}

              <button
                onClick={handleStart}
                disabled={!agreed || starting}
                className="w-full py-5 rounded-web font-black text-white text-xs uppercase tracking-[0.3em] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 bg-indigo-600 shadow-xl shadow-indigo-600/20 hover:bg-indigo-50 hover:text-indigo-900 group"
              >
                {starting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Initializing...
                  </>
                ) : (
                  <>
                    Begin Secure Session <FiPlay className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
          </div>
        </div>
      </div>
    );
  }

  // Active test session
  if (phase === 'active' || phase === 'evaluating') {
    return (
      <div className="h-full flex flex-col">
        {/* Top bar with timer and submit */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/5 backdrop-blur-md">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-secondary opacity-40">Active Evaluation</span>
            <span className="text-sm font-black text-primary truncate max-w-[200px] uppercase tracking-tight">
              {attempt?.test_title || test?.title}
            </span>
          </div>

          {/* Timer */}
          <div className="flex items-center gap-3 px-6 py-2 rounded-2xl glass no-shadow border-white/10">
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-black uppercase tracking-widest text-secondary opacity-40">Time Left</span>
              <span className="font-mono font-black text-xl tabular-nums leading-none mt-1" style={{ color: timerColor }}>
                {formatTime(timeLeft)}
              </span>
            </div>
            <div className="w-1 h-8 rounded-full bg-white/5" />
            <FiClock className="text-xl opacity-20" style={{ color: timerColor }} />
          </div>

          <button
            disabled={submitting || phase === 'evaluating'}
            onClick={() => setShowConfirm(true)}
            className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all bg-indigo-600 shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 hover:-translate-y-1 active:translate-y-0 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'End Test Session'}
          </button>
        </div>

        {/* Integrity warning toast */}
        {integrityToast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[95] animate-in slide-in-from-top-4 duration-300 fade-in">
            <div className="flex items-center gap-3 px-6 py-3 rounded-2xl border shadow-2xl shadow-black/50"
              style={{ background: 'linear-gradient(135deg, rgba(220,38,38,0.95), rgba(180,20,20,0.95))', borderColor: 'rgba(255,120,120,0.4)', backdropFilter: 'blur(20px)' }}>
              <span className="text-xl">⚠️</span>
              <p className="text-[11px] font-black uppercase tracking-widest text-white">{integrityToast}</p>
              <button onClick={() => setIntegrityToast('')} className="ml-2 text-white/50 hover:text-white text-lg leading-none transition-colors">×</button>
            </div>
          </div>
        )}

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
                  onPasteWarning={showToast}
                  onIdleWarning={showToast}
                />
                {/* Nav buttons for debug questions */}
                <div className="flex items-center justify-between px-8 py-4 border-t border-white/10 bg-black/20 backdrop-blur-md">
                  <button disabled={currentIdx === 0} onClick={() => setCurrentIdx(i => i - 1)}
                    className="flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-black/5 text-secondary border border-white/5 hover:bg-black/10 hover:text-primary transition-all disabled:opacity-20">
                    <FiArrowLeft /> Previous
                  </button>
                  <div className="px-4 py-1 bg-black/5 rounded-full border border-white/5">
                    <span className="text-[10px] font-black text-secondary tracking-widest opacity-60">{currentIdx + 1} <span className="opacity-20 mx-1">/</span> {questions.length}</span>
                  </div>
                  <button disabled={currentIdx === questions.length - 1} onClick={() => setCurrentIdx(i => i + 1)}
                    className="flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all disabled:opacity-20">
                    Next Question →
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
                  <div className="flex items-center justify-between pt-8 border-t border-white/5">
                    <button disabled={currentIdx === 0} onClick={() => setCurrentIdx(i => i - 1)}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-black/5 text-secondary border border-white/5 hover:bg-black/10 hover:text-primary transition-all disabled:opacity-20">
                      <FiArrowLeft /> Previous
                    </button>
                    <div className="px-4 py-1.5 bg-black/5 rounded-full border border-white/5">
                        <span className="text-[10px] font-black text-secondary tracking-widest opacity-60">{currentIdx + 1} <span className="opacity-20 mx-1">/</span> {questions.length}</span>
                    </div>
                    <button disabled={currentIdx === questions.length - 1} onClick={() => setCurrentIdx(i => i + 1)}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all disabled:opacity-20">
                      Next Question →
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
          <div className="absolute inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-500">
            <div className="text-center glass p-12 rounded-[2.5rem] border-white/5">
              <span className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin inline-block mb-6" />
              <p className="text-xl font-black text-primary uppercase tracking-tighter">
                Synchronizing Telemetry...
              </p>
              <p className="text-[10px] text-secondary font-bold uppercase tracking-[0.2em] mt-2 opacity-60">Finalizing Evaluation</p>
              {submitError && (
                <p className="text-sm text-red-400 mt-4 bg-red-400/10 p-4 rounded-xl border border-red-400/20">{submitError}</p>
              )}
            </div>
          </div>
        )}

        {/* Integrity Failed screen */}
        {phase === 'integrity-failed' && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center bg-[#0a0a0f]/90 backdrop-blur-xl animate-in fade-in duration-500">
             <div className="max-w-md w-full glass shadow-2xl p-12 text-center border-red-500/20 rounded-[3rem]">
                <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-8 border border-red-500/20 animate-pulse">
                    <FiShield className="text-5xl text-red-500" />
                </div>
                <h2 className="text-3xl font-black text-red-500 uppercase tracking-tighter mb-4">Integrity Breach</h2>
                <div className="space-y-4 mb-8">
                    <p className="text-sm font-bold text-primary opacity-80 uppercase tracking-tight leading-relaxed">
                        Your test session has been <span className="text-red-400">IMMEDIATELY TERMINATED</span>.
                    </p>
                    <p className="text-xs font-bold text-secondary opacity-60 uppercase tracking-widest leading-relaxed">
                        Reason: You have exceeded the maximum allowed tab switches. This incident has been logged and reported to the administrator.
                    </p>
                </div>
                <button
                    onClick={() => windowId && closeWindow(windowId)}
                    className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-primary font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                    Dismiss Session
                </button>
             </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
