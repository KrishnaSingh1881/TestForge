import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import type { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import Terminal from './Terminal';
import type { RunResult } from './Terminal';
import api from '../../lib/axios';
import { useBehavioralTracking } from '../../hooks/useBehavioralTracking';

interface DebuggingQuestion {
  id: string;
  statement: string;
  language: string;
  buggy_code: string;
  correct_code: string;
  test_cases: Array<{
    id: number;
    input: string;
    expected_output: string;
    is_hidden: boolean;
  }>;
}

interface VSCodeLayoutProps {
  question: DebuggingQuestion;
  attemptId: string;
  questionNumber: number;
  initialCode: string;
  initialRunsRemaining: number;
  sessionPhase: 'start-screen' | 'active' | 'evaluating' | 'done';
  onCodeChange: (code: string) => void;
  onAnswered: (qid: string, answered: boolean) => void;
  onPasteWarning?: (msg: string) => void;  // for parent to show toast
  onIdleWarning?: (msg: string) => void;   // for parent to show toast
}

type ActiveTab = 'buggy' | 'fix';

interface VSCodeLayoutState {
  activeTab: ActiveTab;
  terminalHeight: number;
  code: string;
  runResults: RunResult[];
  runsRemaining: number;
  running: boolean;
  cursorPosition: { line: number; col: number };
}

export default function VSCodeLayout({
  question,
  attemptId,
  questionNumber,
  initialCode,
  initialRunsRemaining,
  sessionPhase,
  onCodeChange,
  onAnswered,
  onPasteWarning,
  onIdleWarning,
}: VSCodeLayoutProps) {
  const [state, setState] = useState<VSCodeLayoutState>({
    activeTab: 'fix',
    terminalHeight: 200,
    code: initialCode || question.buggy_code,
    runResults: [],
    runsRemaining: initialRunsRemaining,
    running: false,
    cursorPosition: { line: 1, col: 1 },
  });

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const questionOpenTime = useRef(Date.now());

  const { meta, onKeyDown, onPaste, onRunCode, lastIdleWarningRef } = useBehavioralTracking(questionOpenTime.current);

  // Update code when it changes
  useEffect(() => {
    if (state.code !== initialCode) {
      onCodeChange(state.code);
    }
  }, [state.code, initialCode, onCodeChange]);

  // Idle warning — fire when useBehavioralTracking detects >2 min idle
  const idleWarnIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (sessionPhase !== 'active') return;
    idleWarnIntervalRef.current = setInterval(() => {
      // Check if we're currently in an idle (using exposed lastIdleWarningRef)
      if (lastIdleWarningRef?.current) {
        const idleSecs = Math.round((Date.now() - lastIdleWarningRef.current) / 1000);
        if (idleSecs > 120 && idleSecs % 60 < 11) { // warn every ~60s while idle
          onIdleWarning?.(`😴 Idle for ${Math.floor(idleSecs / 60)}m — this is being recorded`);
        }
      }
    }, 10_000);
    return () => { if (idleWarnIntervalRef.current) clearInterval(idleWarnIntervalRef.current); };
  }, [sessionPhase, onIdleWarning]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Attach behavioral tracking
    editor.onKeyDown((e) => {
      onKeyDown(e);
    });

    editor.onDidPaste(() => {
      onPaste();
      onPasteWarning?.('📋 Paste detected — this is flagged and recorded');
    });

    // Track cursor position
    editor.onDidChangeCursorPosition((e) => {
      setState(s => ({
        ...s,
        cursorPosition: { line: e.position.lineNumber, col: e.position.column },
      }));
    });

    // Track code changes
    editor.onDidChangeModelContent(() => {
      const value = editor.getValue();
      setState(s => ({ ...s, code: value }));
    });
  };

  const handleRun = async () => {
    if (state.running || state.runsRemaining === 0) return;

    setState(s => ({ ...s, running: true }));
    onRunCode();

    try {
      const response = await api.post('/execute', {
        attempt_id: attemptId,
        question_id: question.id,
        code: state.code,
        language: question.language,
      });

      const results: RunResult[] = response.data.results || [];
      const newRunsRemaining = response.data.runs_remaining ?? state.runsRemaining - 1;

      setState(s => ({
        ...s,
        runResults: results,
        runsRemaining: newRunsRemaining,
        running: false,
      }));

      // Save response with behavioral meta after each run
      await api.post(`/attempts/${attemptId}/responses`, {
        question_id: question.id,
        submitted_code: state.code,
        language: question.language,
        time_spent_seconds: Math.floor((Date.now() - questionOpenTime.current) / 1000),
        behavioral_meta: meta,
      }).catch(() => {});

      const anyPassed = results.some(r => r.passed);
      if (anyPassed) onAnswered(question.id, true);
    } catch (err) {
      console.error('Failed to execute code:', err);
      setState(s => ({ ...s, running: false }));
    }
  };

  const maxTerminalHeight = containerRef.current
    ? Math.floor(containerRef.current.clientHeight * 0.6)
    : 400;

  return (
    <div ref={containerRef} className="vscode-layout flex flex-col h-full">
      {/* ── Question statement panel ── */}
      <div className="flex-shrink-0 border-b px-5 py-3 flex items-start gap-4"
        style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.25)' }}>
        <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg text-[10px] font-black"
          style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
          {questionNumber}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
              🐛 Debugging
            </span>
            {question.marks && (
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}>
                {question.marks} marks
              </span>
            )}
          </div>
          <p className="text-xs font-semibold leading-relaxed" style={{ color: '#d1d5db' }}>
            {question.statement}
          </p>
        </div>
      </div>

      {/* ── Editor + Terminal ── */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Tab bar */}
        <div
          className="flex items-center border-b"
          style={{
            backgroundColor: 'var(--vscode-titlebar-bg)',
            borderColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <button
            onClick={() => setState(s => ({ ...s, activeTab: 'buggy' }))}
            className="flex items-center gap-2 px-4 py-2 text-sm border-b-2 transition-colors"
            style={{
              backgroundColor:
                state.activeTab === 'buggy' ? 'var(--vscode-tab-active-bg)' : 'var(--vscode-tab-inactive-bg)',
              borderBottomColor: state.activeTab === 'buggy' ? '#ff5f57' : 'transparent',
              color: state.activeTab === 'buggy' ? '#ffffff' : '#858585',
            }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ff5f57' }} />
            <span>Buggy Code</span>
          </button>
          <button
            onClick={() => setState(s => ({ ...s, activeTab: 'fix' }))}
            className="flex items-center gap-2 px-4 py-2 text-sm border-b-2 transition-colors"
            style={{
              backgroundColor:
                state.activeTab === 'fix' ? 'var(--vscode-tab-active-bg)' : 'var(--vscode-tab-inactive-bg)',
              borderBottomColor: state.activeTab === 'fix' ? '#6366f1' : 'transparent',
              color: state.activeTab === 'fix' ? '#ffffff' : '#858585',
            }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#6366f1' }} />
            <span>Your Fix</span>
          </button>
        </div>

        {/* Monaco Editor */}
        <div className="flex-1" style={{ backgroundColor: 'var(--vscode-editor-bg)' }}>
          {state.activeTab === 'buggy' ? (
            <Editor
              height="100%"
              language={question.language}
              value={question.buggy_code}
              theme="vs-dark"
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          ) : (
            <Editor
              height="100%"
              language={question.language}
              value={state.code}
              theme="vs-dark"
              onMount={handleEditorMount}
              options={{
                readOnly: false,
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          )}
        </div>

        {/* Terminal */}
        <Terminal
          results={state.runResults}
          runsRemaining={state.runsRemaining}
          running={state.running}
          onRun={handleRun}
          height={state.terminalHeight}
          onHeightChange={(h) => setState(s => ({ ...s, terminalHeight: h }))}
          maxHeight={maxTerminalHeight}
        />

        {/* Status bar */}
        <div
          className="flex items-center justify-between px-4 py-0.5 text-xs flex-shrink-0"
          style={{
            height: '22px',
            backgroundColor:
              sessionPhase === 'active' ? 'var(--vscode-statusbar-test-bg)' : 'var(--vscode-statusbar-bg)',
            color: '#ffffff',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="font-semibold">{question.language}</span>
            <span>
              Ln {state.cursorPosition.line}, Col {state.cursorPosition.col}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {state.running ? (
              <span>● Running...</span>
            ) : state.runResults.length > 0 ? (
              <span>
                {state.runResults.filter(r => r.passed).length}/{state.runResults.length} tests passed
              </span>
            ) : (
              <span>Ready</span>
            )}
          </div>
        </div>
      </div>{/* end editor+terminal flex-1 */}
    </div>
  );
}
