import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../lib/axios';
import { useOSStore } from '../store/useOSStore';
import { useHeartbeat } from '../../hooks/useHeartbeat';
import { useIntegrityListeners } from '../../hooks/useIntegrityListeners';
import { useOSSettings } from '../store/useOSSettings';
import QuestionNavigator from '../../components/test/QuestionNavigator';
import MCQQuestion from '../../components/test/MCQQuestion';
import SubmitConfirmModal from '../../components/test/SubmitConfirmModal';
import CodingEditorOverlay from '../components/CodingEditorOverlay';
import Counter from '../../components/Counter';
import {
  FiAlertTriangle, FiShield, FiClock, FiBox, FiPlus, FiPlay, FiArrowLeft, FiCode,
} from 'react-icons/fi';
import OrbitalBuffer from '../components/OrbitalBuffer';


type SessionPhase = 'start-screen' | 'active' | 'evaluating' | 'concluded' | 'integrity-failed' | 'done';

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

function pctColor(pct: number) {
  if (pct >= 80) return '#4ade80';
  if (pct >= 50) return '#facc15';
  return '#f87171';
}

interface TestSessionAppProps {
  testId?: string;
  attemptId?: string;
}

export default function TestSessionApp({ id: windowId, testId, attemptId: initialAttemptId }: TestSessionAppProps & { id: string }) {
  const { openWindow, closeWindow, lockWindow, unlockWindow } = useOSStore();
  const { isFocusMode, setFocusMode } = useOSSettings();

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

  // Fullscreen coding overlay
  const [codingOverlayQ, setCodingOverlayQ] = useState<any | null>(null);

  // Live integrity score (starts at 100, decremented client-side for instant feedback)
  const [liveIntegrity, setLiveIntegrity] = useState(100);
  const liveIntegrityRef = useRef(100);

  function deductIntegrity(points: number, reason: string) {
    const newScore = Math.max(0, liveIntegrityRef.current - points);
    liveIntegrityRef.current = newScore;
    setLiveIntegrity(newScore);
    showToast(`⚠️ ${reason} — Integrity: ${newScore}/100`);
    if (newScore <= 0) {
      showToast('🚨 Integrity score reached 0 — Auto-submitting!');
      setTimeout(() => handleSubmit(true, 'integrity_zero'), 1500);
    }
  }

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
      console.log('📊 Loaded attempt data:', { 
        status: data.status, 
        time_remaining_seconds: data.time_remaining_seconds,
        started_at: data.started_at,
        duration_mins: data.duration_mins 
      });

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
      
      // Lock and maximize window
      if (windowId) {
        lockWindow(windowId);
        // Maximize the window using the store method
        const store = useOSStore.getState();
        store.maximizeWindow(windowId);
        console.log('🪟 Window locked and maximized:', windowId);
      }
    } catch (err) {
      console.error('❌ Failed to load attempt:', err);
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

  // Countdown timer — only start if there's actually time remaining
  useEffect(() => {
    console.log('⏱️ Timer effect triggered:', { phase, timeLeft });
    
    if (phase !== 'active') {
      console.log('⏱️ Timer not starting: phase not active');
      return;
    }
    
    if (timeLeft <= 0) {
      console.log('⏱️ Timer not starting: timeLeft is 0 or negative');
      console.log('⏱️ Check server response for time_remaining_seconds');
      return;
    }
    
    console.log('⏱️ Starting countdown timer from', timeLeft, 'seconds');
    
    const id = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;
        if (next <= 0) {
          console.log('⏱️ Timer reached 0 - auto-submitting');
          clearInterval(id);
          handleAutoSubmit();
          return 0;
        }
        if (next % 60 === 0) {
          console.log('⏱️ Timer:', next, 'seconds remaining');
        }
        return next;
      });
      
      // Update elapsed minutes
      if (startedAtRef.current) {
        setElapsedMins((Date.now() - startedAtRef.current.getTime()) / 60000);
      }
    }, 1000);
    
    return () => {
      console.log('⏱️ Cleaning up timer interval');
      clearInterval(id);
    };
  }, [phase, timeLeft]); // Depend on both phase AND timeLeft to restart if timeLeft changes

  // Phase 6: Automated Focus Mode
  useEffect(() => {
    if (phase === 'active') {
      const prevMode = isFocusMode;
      setFocusMode(true);
      return () => setFocusMode(prevMode);
    }
  }, [phase, setFocusMode]);

  // Enforce test settings (copy-paste, right-click, keyboard shortcuts) during active test
  useEffect(() => {
    if (phase !== 'active') return;

    const handlers: Array<[string, EventListener]> = [];

    // Disable text selection entirely during test
    const styleEl = document.createElement('style');
    styleEl.id = 'test-no-select';
    styleEl.textContent = `
      * { user-select: none !important; -webkit-user-select: none !important; }
      input, textarea, [contenteditable] { user-select: text !important; -webkit-user-select: text !important; }
    `;
    document.head.appendChild(styleEl);

    const copyHandler = (e: Event) => {
      e.preventDefault();
      deductIntegrity(10, 'Copy attempt blocked (−10)');
    };
    document.addEventListener('copy', copyHandler);
    handlers.push(['copy', copyHandler]);

    const pasteHandler = (e: Event) => {
      e.preventDefault();
      deductIntegrity(10, 'Paste attempt blocked (−10)');
    };
    document.addEventListener('paste', pasteHandler);
    handlers.push(['paste', pasteHandler]);

    if (!testSettings.allow_right_click) {
      const h = (e: Event) => e.preventDefault();
      document.addEventListener('contextmenu', h);
      handlers.push(['contextmenu', h]);
    }

    const keyHandler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); e.stopPropagation(); }
      if (ctrl && (e.key === 'v' || e.key === 'V')) { e.preventDefault(); e.stopPropagation(); deductIntegrity(10, 'Paste attempt blocked (−10)'); }
      if (ctrl && (e.key === 'x' || e.key === 'X')) { e.preventDefault(); e.stopPropagation(); }
      if (e.key === 'F12') e.preventDefault();
      if (ctrl && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) e.preventDefault();
      if (ctrl && e.key === 'u') e.preventDefault();
    };
    document.addEventListener('keydown', keyHandler, true);
    handlers.push(['keydown', keyHandler as EventListener]);

    return () => {
      handlers.forEach(([event, handler]) => document.removeEventListener(event, handler, true as any));
      document.getElementById('test-no-select')?.remove();
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
      deductIntegrity(30, `Tab switch detected (−30)`);
    },
    onTabSwitchCount: (count) => {
      if (count >= 3) {
        showToast('🚨 3 tab switches — Auto-submitting!');
        setTimeout(() => handleSubmit(true, 'integrity_violation'), 1000);
      }
    },
  });

  // checkIntegrityViolation is now driven by onTabSwitchCount callback above
  // Kept for manual checks if needed
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
        setPhase('concluded');
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
        <div className="flex flex-col items-center gap-6">
          <OrbitalBuffer size={64} className="text-accent" />
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-secondary opacity-30 animate-pulse">Initialising Secure Session...</p>
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

  if (phase === 'integrity-failed') {
    return (
      <div className="absolute inset-0 z-[120] flex items-center justify-center bg-[#0a0a0f]/95 backdrop-blur-xl animate-in fade-in duration-500">
         <div className="max-w-md w-full glass-2 p-12 text-center border-red-500/20 rounded-[3rem] bg-black/40">
            <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-8 border border-red-500/20 animate-pulse">
                <FiShield className="text-5xl text-red-500" />
            </div>
            <h2 className="text-3xl font-black text-red-400 uppercase tracking-tighter mb-4">Integrity Breach</h2>
            <div className="space-y-4 mb-8">
                <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] leading-relaxed opacity-60">
                    Security protocols have <span className="text-red-400">IMMEDIATELY TERMINATED</span> this session.
                </p>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                    <p className="text-[9px] font-black text-secondary uppercase tracking-widest">Reason for Lockout</p>
                    <p className="text-xs font-bold text-primary uppercase">{submitError || 'Multiple tab switches or focus loss detected.'}</p>
                </div>
            </div>
            <button
                onClick={() => {
                    openWindow('results', { attemptId });
                    if (windowId) closeWindow(windowId);
                }}
                className="w-full py-5 rounded-web bg-accent text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-accent/20 hover:bg-accent/90 transition-all"
            >
                Review Evaluation Results
            </button>
         </div>
      </div>
    );
  }

  if (phase === 'concluded') {
    return (
      <div className="absolute inset-0 z-[110] flex items-center justify-center bg-[#0a0a0f]/95 backdrop-blur-xl animate-in fade-in duration-500">
         <div className="max-w-md w-full glass-2 p-12 text-center border-white/10 rounded-[3rem] bg-white/[0.02]">
            <div className="w-24 h-24 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-8 border border-green-500/20">
                <FiShield className="text-5xl text-green-400" />
            </div>
            <h2 className="text-3xl font-black text-primary uppercase tracking-tighter mb-4">Session Secure</h2>
            <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-8 opacity-60">
                Evaluation completed and synchronized successfully.
            </p>
            <div className="space-y-3">
                <button
                    onClick={() => {
                        openWindow('results', { attemptId });
                        if (windowId) closeWindow(windowId);
                    }}
                    className="w-full py-5 rounded-web bg-accent text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-accent/20 hover:bg-accent/90 transition-all"
                >
                    Review Evaluation Results
                </button>
                <button
                    onClick={() => windowId && closeWindow(windowId)}
                    className="w-full py-4 rounded-web bg-black/5 text-secondary font-black uppercase tracking-widest hover:bg-white/5 transition-all text-[10px]"
                >
                    Return to Academic Hub
                </button>
            </div>
         </div>
      </div>
    );
  }

  if (phase === 'active' || phase === 'evaluating') {
    return (
      <div className="h-full flex flex-col relative" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
        {/* ── Fullscreen coding overlay ── */}
        {codingOverlayQ && (
          <CodingEditorOverlay
            key={codingOverlayQ.id}
            question={codingOverlayQ}
            questionNumber={currentIdx + 1}
            totalQuestions={questions.length}
            attemptId={attemptId!}
            initialCode={codingOverlayQ.saved_response?.submitted_code || codingOverlayQ.buggy_code || ''}
            runsRemaining={runsRemaining}
            timeLeft={timeLeft}
            disablePaste={!testSettings.allow_paste}
            onPasteAttempt={() => deductIntegrity(5, 'Paste in editor blocked (−5)')}
            onSubmit={(qid) => {
              onAnswered(qid, true);
              setCodingOverlayQ(null);
              setCurrentIdx(i => Math.min(i + 1, questions.length - 1));
            }}
            onSkip={() => setCodingOverlayQ(null)}
            onClose={() => setCodingOverlayQ(null)}
          />
        )}

        {/* Top bar with timer and submit */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-white/5 bg-white/[0.02] backdrop-blur-md animate-in slide-in-from-top-4 duration-500 relative z-[90]">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-secondary tracking-[0.3em] opacity-40">Active Proctored Hub</span>
              <h2 className="text-sm font-black text-primary uppercase tracking-tight mt-0.5">{test?.title}</h2>
            </div>
            <div className="w-1 h-8 rounded-full bg-white/5" />
            <div className={`flex flex-col ${liveIntegrityRef.current < 50 ? 'animate-pulse' : ''}`}>
              <span className="text-[10px] font-black uppercase text-secondary tracking-[0.3em] opacity-40">Biometric Integrity</span>
              <div className="flex items-center gap-2 mt-0.5">
                 <span className="text-sm font-black font-mono tracking-tight" style={{ color: pctColor(liveIntegrityRef.current) }}>
                   {liveIntegrityRef.current}/100
                 </span>
                 <div className="w-16 h-1 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full transition-all duration-500" style={{ width: `${liveIntegrityRef.current}%`, backgroundColor: pctColor(liveIntegrityRef.current) }} />
                 </div>
              </div>
            </div>
          </div>

          <div className="flex-1 max-w-md mx-8 flex flex-col gap-1.5">
             <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-secondary opacity-40 px-1">
                <span>Evaluation Progress</span>
                <span>{answeredIds.size} / {questions.length} answered</span>
             </div>
             <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="h-full bg-accent shadow-[0_0_10px_rgba(var(--accent-rgb),0.5)] transition-all duration-700"
                  style={{ width: `${(answeredIds.size / questions.length) * 100}%` }}
                />
             </div>
          </div>

          <div className="flex items-center gap-3 px-6 py-2 rounded-2xl glass no-shadow border-white/10">
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-black uppercase tracking-widest text-secondary opacity-40">Time Left</span>
              <div className="mt-1">
                <Counter
                  value={timeLeft}
                  fontSize={24}
                  padding={4}
                  gap={2}
                  borderRadius={6}
                  horizontalPadding={8}
                  textColor={timerColor}
                  fontWeight="900"
                  gradientFrom="transparent"
                  gradientTo="transparent"
                  counterStyle={{
                    fontFamily: 'monospace',
                  }}
                />
              </div>
            </div>
            <div className="w-1 h-8 rounded-full bg-white/5" />
            <FiClock className="text-xl opacity-20" style={{ color: timerColor }} />
          </div>
        </div>

        {/* Integrity warning toast */}
        {integrityToast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[95] animate-in slide-in-from-top-4 duration-300 fade-in">
            <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl border shadow-2xl shadow-black/50 backdrop-blur-xl animate-pulse`}
              style={{ 
                background: liveIntegrityRef.current > 50 
                  ? 'linear-gradient(135deg, rgba(234,179,8,0.9), rgba(202,138,4,0.9))' 
                  : 'linear-gradient(135deg, rgba(220,38,38,0.9), rgba(180,20,20,0.9))',
                borderColor: liveIntegrityRef.current > 50 ? 'rgba(255,255,200,0.4)' : 'rgba(255,120,120,0.4)'
              }}>
              <span className="text-xl">{liveIntegrityRef.current > 50 ? '⚠️' : '🚨'}</span>
              <p className="text-[11px] font-black uppercase tracking-widest text-white">{integrityToast}</p>
              <button onClick={() => setIntegrityToast('')} className="ml-2 text-white/50 hover:text-white text-lg leading-none transition-colors">×</button>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          <QuestionNavigator
            questions={questions}
            currentIdx={currentIdx}
            answeredIds={answeredIds}
            reviewIds={reviewIds}
            elapsedMinutes={elapsedMins}
            onSelect={setCurrentIdx}
          />

          <main className="flex-1 min-h-0 overflow-hidden relative">
            {!currentQ ? (
              <div className="h-full flex items-center justify-center">
                <div className="glass-2 p-10 text-center bg-white/[0.01]">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary opacity-40">Synchronizing item registry...</p>
                </div>
              </div>
            ) : elapsedMins < (currentQ.unlock_at_minutes ?? 0) ? (
              <div className="h-full flex items-center justify-center p-8">
                <div className="glass-2 p-12 text-center bg-white/[0.01]">
                  <p className="text-4xl mb-4 grayscale">🔒</p>
                  <p className="text-lg font-black text-primary uppercase tracking-tight mb-2">Item Access Restricted</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-secondary opacity-40">
                    Temporal lock active. Access granted at {currentQ.unlock_at_minutes} minute mark.
                  </p>
                </div>
              </div>
            ) : (currentQ.type === 'debugging' || currentQ.type === 'coding') ? (
              <div className="h-full overflow-y-auto p-8 flex items-center justify-center">
                <div className="max-w-2xl w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="glass no-shadow p-6 rounded-[2rem] border-white/5 space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-accent/10 text-accent border border-accent/20">
                        {currentQ.type === 'debugging' ? '🐛 Algorithmic Debug' : '💻 Logic Synthesis'}
                      </span>
                      {currentQ.marks && (
                        <span className="text-[10px] font-bold text-secondary opacity-50">{currentQ.marks} marks</span>
                      )}
                    </div>
                    <p className="text-base font-semibold text-primary leading-relaxed">{currentQ.statement}</p>
                  </div>

                  {currentQ.buggy_code && (
                    <div className="glass-2 rounded-[2rem] border-white/5 overflow-hidden bg-white/[0.01]">
                      <div className="px-4 py-2 flex items-center gap-2 border-b bg-red-500/5 border-red-500/10">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-red-400">Fault Trace (Buggy Code)</span>
                      </div>
                      <pre className="p-4 text-xs font-mono text-primary/70 overflow-x-auto max-h-48 custom-scrollbar leading-relaxed whitespace-pre-wrap">
                        {currentQ.buggy_code}
                      </pre>
                    </div>
                  )}

                  <button
                    onClick={() => setCodingOverlayQ(currentQ)}
                    className="w-full flex items-center justify-center gap-4 py-5 rounded-[2rem] font-black text-sm uppercase tracking-[0.25em] text-white transition-all hover:-translate-y-1 active:translate-y-0"
                    style={{ background: 'linear-gradient(135deg, rgb(var(--accent-rgb)) 0%, rgb(var(--accent-rgb)) 100%)', boxShadow: '0 8px 32px rgba(var(--accent-rgb),0.5)' }}
                  >
                    <FiCode className="text-xl" />
                    Launch Full-Screen Editor
                  </button>

                  <div className="flex items-center justify-between pt-2">
                    <button disabled={currentIdx === 0} onClick={() => setCurrentIdx(i => i - 1)}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-black/5 text-secondary border border-white/5 hover:bg-black/10 hover:text-primary transition-all disabled:opacity-20">
                      <FiArrowLeft /> Previous
                    </button>
                    <span className="text-[10px] font-black text-secondary opacity-40">{currentIdx + 1} / {questions.length}</span>
                    <button disabled={currentIdx === questions.length - 1} onClick={() => setCurrentIdx(i => i + 1)}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-all disabled:opacity-20">
                      Next Question →
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full overflow-y-auto p-8">
                <div className="max-w-3xl mx-auto space-y-6">
                  {!attemptId ? (
                    <div className="flex items-center justify-center h-64">
                      <OrbitalBuffer size={40} className="text-accent" />
                      <p className="ml-4 text-sm text-secondary">Loading attempt...</p>
                    </div>
                  ) : (currentQ.type === 'mcq_single' || currentQ.type === 'mcq_multi') && (
                    <MCQQuestion
                      key={currentQ.id}
                      question={currentQ}
                      attemptId={attemptId}
                      questionNumber={currentIdx + 1}
                      isMarkedForReview={reviewIds.has(currentQ.id)}
                      onAnswered={onAnswered}
                      onToggleReview={onToggleReview}
                      onNext={() => setCurrentIdx(i => Math.min(i + 1, questions.length - 1))}
                    />
                  )}
                </div>
              </div>
            )}
          </main>
        </div>

        {showConfirm && (
          <SubmitConfirmModal
            answeredCount={answeredIds.size}
            totalCount={questions.length}
            onConfirm={() => handleSubmit(false)}
            onCancel={() => setShowConfirm(false)}
          />
        )}

        {phase === 'evaluating' && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-500">
            <div className="text-center glass p-12 rounded-[2.5rem] border-white/5">
              <OrbitalBuffer size={64} className="text-accent mb-6" />
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
      </div>
    );
  }

  return null;
}
