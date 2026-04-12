import { useState, useRef, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import type { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { FiPlay, FiSkipForward, FiSend, FiX, FiAlertTriangle, FiShield, FiEye } from 'react-icons/fi';
import api from '../../lib/axios';
import { useBehavioralTracking } from '../../hooks/useBehavioralTracking';

interface TestCase {
  id: number;
  input: string;
  expected_output: string;
  is_hidden: boolean;
}

interface Question {
  id: string;
  statement: string;
  language: string;
  buggy_code: string;
  marks?: number;
  test_cases?: TestCase[];
}

interface RunResult {
  test_case_id: number;
  passed: boolean;
  actual_output: string;
  expected_output: string;
  is_hidden: boolean;
  error?: string;
}

interface CodingEditorOverlayProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  attemptId: string;
  initialCode: string;
  runsRemaining: number;
  timeLeft: number;
  disablePaste?: boolean;
  onPasteAttempt?: () => void;
  onSubmit: (qid: string, code: string) => void;
  onSkip: () => void;
  onClose: () => void;
}

function formatTime(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function CodingEditorOverlay({
  question,
  questionNumber,
  totalQuestions,
  attemptId,
  initialCode,
  runsRemaining: initialRuns,
  timeLeft,
  disablePaste = true,
  onPasteAttempt,
  onSubmit,
  onSkip,
  onClose,
}: CodingEditorOverlayProps) {
  const [code, setCode] = useState(initialCode || question.buggy_code || '');
  const [runsLeft, setRunsLeft] = useState(initialRuns);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RunResult[]>([]);
  const [submitConfirm, setSubmitConfirm] = useState(false);
  const [toast, setToast] = useState('');
  const [activePanel, setActivePanel] = useState<'buggy' | 'editor'>('editor');
  const [showBuggy, setShowBuggy] = useState(false); // side-by-side on wide screens

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const questionOpenTime = useRef(Date.now());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { meta, onKeyDown, onPaste, onRunCode } = useBehavioralTracking(questionOpenTime.current);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  }, []);

  // No body scroll lock needed — overlay is contained within the test window
  useEffect(() => {
    return () => {};
  }, []);

  // Block copy/paste shortcuts
  useEffect(() => {
    const blockKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 'v') {
        e.preventDefault();
        e.stopPropagation();
        if (disablePaste) {
          showToast('⛔ Paste blocked — integrity penalty applied');
          onPasteAttempt?.();
        }
        api.patch(`/attempts/${attemptId}/integrity`, { event: 'focus_lost' }).catch(() => {});
      }
      if (ctrl && e.key === 'c') { e.preventDefault(); e.stopPropagation(); }
      if (e.key === 'F12') e.preventDefault();
      if (ctrl && e.shiftKey && ['I','J','C'].includes(e.key)) e.preventDefault();
    };
    document.addEventListener('keydown', blockKey, true);
    return () => document.removeEventListener('keydown', blockKey, true);
  }, [attemptId, showToast]);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.onKeyDown(onKeyDown);
    editor.onDidPaste(() => {
      onPaste();
      if (disablePaste) {
        // Undo the paste immediately
        editor.trigger('keyboard', 'undo', null);
        showToast('⛔ Paste blocked — integrity penalty applied');
        onPasteAttempt?.();
        api.patch(`/attempts/${attemptId}/integrity`, { event: 'focus_lost' }).catch(() => {});
      } else {
        showToast('📋 Paste detected and flagged');
        api.patch(`/attempts/${attemptId}/integrity`, { event: 'focus_lost' }).catch(() => {});
      }
    });
    editor.onDidChangeModelContent(() => {
      setCode(editor.getValue());
    });
  };

  const handleRun = async () => {
    if (running || runsLeft <= 0) return;
    setRunning(true);
    onRunCode();
    try {
      const { data } = await api.post('/execute', {
        attempt_id: attemptId,
        question_id: question.id,
        code,
        language: question.language,
      });
      setResults(data.results ?? []);
      setRunsLeft(data.runs_remaining ?? runsLeft - 1);
    } catch {
      showToast('Execution failed. Check your code.');
    } finally {
      setRunning(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitConfirm(false);
    // Save response with behavioral meta
    await api.post(`/attempts/${attemptId}/responses`, {
      question_id: question.id,
      submitted_code: code,
      language: question.language,
      time_spent_seconds: Math.floor((Date.now() - questionOpenTime.current) / 1000),
      behavioral_meta: meta,
    }).catch(() => {});
    onSubmit(question.id, code);
  };

  const passedCount = results.filter(r => r.passed).length;
  const timerColor = timeLeft < 300 ? '#f87171' : timeLeft < 600 ? '#facc15' : '#4ade80';
  const allPassed = results.length > 0 && passedCount === results.length;

  return (
    <div
      className="absolute inset-0 flex flex-col"
      style={{
        zIndex: 9999,
        background: 'linear-gradient(135deg, #0a0a14 0%, #0d0d1e 50%, #080814 100%)',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* ── Top Bar ── */}
      <div
        className="flex items-center gap-4 px-6 py-3 shrink-0 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.4)' }}
      >
        {/* Question badge */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            🐛 Debug Q{questionNumber}/{totalQuestions}
          </div>
          {question.marks && (
            <span className="text-[10px] font-bold text-secondary opacity-40">{question.marks} marks</span>
          )}
        </div>

        {/* Statement preview */}
        <p className="flex-1 text-xs text-primary/60 font-medium truncate hidden md:block">
          {question.statement}
        </p>

        {/* Timer */}
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <span className="text-[9px] font-black uppercase tracking-widest opacity-40" style={{ color: timerColor }}>Time</span>
          <span className="font-mono font-black text-base tabular-nums" style={{ color: timerColor }}>{formatTime(timeLeft)}</span>
        </div>

        {/* Show/hide buggy toggle */}
        <button
          onClick={() => setShowBuggy(b => !b)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
          style={{
            background: showBuggy ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
            color: showBuggy ? '#f87171' : 'rgba(255,255,255,0.5)',
            border: `1px solid ${showBuggy ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.08)'}`,
          }}
        >
          <FiEye /> {showBuggy ? 'Hide Buggy' : 'Show Buggy'}
        </button>

        {/* Runs remaining */}
        <div className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl"
          style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>
          {runsLeft} runs left
        </div>

        {/* Actions */}
        <button
          onClick={handleRun}
          disabled={running || runsLeft <= 0}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all disabled:opacity-40"
          style={{ background: running ? 'rgba(99,102,241,0.3)' : 'rgb(99,102,241)', boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }}
        >
          {running ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FiPlay />}
          {running ? 'Running…' : 'Run'}
        </button>

        <button
          onClick={() => setSubmitConfirm(true)}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all"
          style={{ background: allPassed ? 'rgba(74,222,128,0.9)' : 'rgba(16,185,129,0.8)', color: allPassed ? '#000' : '#fff', boxShadow: '0 4px 20px rgba(16,185,129,0.3)' }}
        >
          <FiSend /> Submit
        </button>

        <button
          onClick={onSkip}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <FiSkipForward /> Skip
        </button>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 px-6 py-3 rounded-2xl border shadow-2xl"
            style={{ background: 'linear-gradient(135deg, rgba(220,38,38,0.95),rgba(185,20,20,0.95))', borderColor: 'rgba(255,100,100,0.4)', backdropFilter: 'blur(20px)' }}>
            <FiAlertTriangle className="text-white text-lg" />
            <p className="text-[11px] font-black uppercase tracking-widest text-white">{toast}</p>
            <button onClick={() => setToast('')} className="text-white/50 hover:text-white ml-2 text-lg">×</button>
          </div>
        </div>
      )}

      {/* ── Main Editor Area ── */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Buggy code reference (shown when toggled) */}
        {showBuggy && (
          <div className="flex flex-col w-[40%] min-w-0 border-r" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="px-4 py-2 shrink-0 flex items-center gap-2 border-b"
              style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.15)' }}>
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#f87171' }}>Buggy Code (Read Only)</span>
            </div>
            {/* Problem statement */}
            <div className="px-4 py-3 border-b text-xs leading-relaxed shrink-0"
              style={{ borderColor: 'rgba(255,255,255,0.05)', color: '#9ca3af', background: 'rgba(0,0,0,0.2)' }}>
              {question.statement}
            </div>
            <div className="flex-1 min-h-0">
              <Editor
                height="100%"
                language={question.language}
                value={question.buggy_code}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                }}
              />
            </div>
          </div>
        )}

        {/* Right: Fix editor */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <div className="px-4 py-2 shrink-0 flex items-center gap-2 border-b"
            style={{ background: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.15)' }}>
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#818cf8' }}>Your Fix</span>
            {results.length > 0 && (
              <span className={`ml-auto text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${allPassed ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {passedCount}/{results.length} tests passed
              </span>
            )}
          </div>
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              language={question.language}
              value={code}
              theme="vs-dark"
              onMount={handleEditorMount}
              options={{
                readOnly: false,
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                padding: { top: 12 },
              }}
            />
          </div>

          {/* Terminal / Results */}
          {results.length > 0 && (
            <div className="shrink-0 max-h-52 overflow-auto border-t" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.5)' }}>
              <div className="px-4 py-2 border-b flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Test Results</span>
              </div>
              <div className="p-3 space-y-1.5">
                {results.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs"
                    style={{ background: r.passed ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${r.passed ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                    <span className={r.passed ? 'text-green-400' : 'text-red-400'}>{r.passed ? '✓' : '✗'}</span>
                    {r.is_hidden ? (
                      <span className="text-secondary opacity-60">Hidden test case {i + 1}</span>
                    ) : (
                      <>
                        <span className="font-mono text-primary/70">Expected: {r.expected_output}</span>
                        {!r.passed && <span className="font-mono text-red-400/70">Got: {r.actual_output || r.error || '—'}</span>}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Integrity badge ── */}
      <div className="shrink-0 flex items-center gap-3 px-6 py-2 border-t"
        style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.3)' }}>
        <FiShield className="text-red-500/40 text-sm" />
        <span className="text-[9px] font-black uppercase tracking-widest text-secondary opacity-30">
          Integrity Monitoring Active · Paste &amp; Tab Switch Flagged
        </span>
        <span className="ml-auto text-[9px] font-black uppercase tracking-widest opacity-20">
          {question.language?.toUpperCase()}
        </span>
      </div>

      {/* ── Submit confirmation ── */}
      {submitConfirm && (
        <div className="absolute inset-0 z-[102] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)' }}>
          <div className="glass p-10 rounded-[2.5rem] text-center max-w-sm w-full border-white/10 shadow-2xl">
            <p className="text-2xl mb-2">📤</p>
            <h3 className="text-lg font-black text-primary uppercase tracking-tight mb-2">Submit this fix?</h3>
            {results.length > 0 ? (
              <p className="text-sm text-secondary mb-6">{passedCount} of {results.length} test cases pass. Are you sure?</p>
            ) : (
              <p className="text-sm text-secondary mb-6">You haven't run your code yet. Submit anyway?</p>
            )}
            <div className="flex gap-3">
              <button onClick={handleSubmit}
                className="flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest text-white"
                style={{ background: 'rgb(99,102,241)' }}>
                Yes, Submit
              </button>
              <button onClick={() => setSubmitConfirm(false)}
                className="px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest text-secondary"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
