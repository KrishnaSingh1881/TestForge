import { useCallback, useEffect, useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import api from '../../lib/axios';
import { useBehavioralTracking } from '../../hooks/useBehavioralTracking';

interface TestCase { input: string; expected_output: string; }
interface RunResult {
  input: string; expected_output: string;
  actual_output: string | null; stderr: string | null; passed: boolean;
}

interface Question {
  id: string;
  statement: string;
  statement_image_url: string | null;
  marks: number;
  buggy_code: string;
  language: 'python' | 'cpp';
  saved_response: { submitted_code?: string; behavioral_meta?: any } | null;
}

interface Props {
  question: Question;
  attemptId: string;
  questionNumber: number;
  initialRunsRemaining: number;
  isMarkedForReview: boolean;
  onAnswered: (qid: string, answered: boolean) => void;
  onToggleReview: (qid: string) => void;
}

const MONACO_OPTS = {
  fontSize: 14,
  minimap: { enabled: false },
  lineNumbers: 'on' as const,
  scrollBeyondLastLine: false,
  padding: { top: 12, bottom: 12 },
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
};

export default function DebugQuestion({
  question, attemptId, questionNumber, initialRunsRemaining,
  isMarkedForReview, onAnswered, onToggleReview,
}: Props) {
  const lang = question.language === 'cpp' ? 'cpp' : 'python';

  const [code, setCode]               = useState(
    question.saved_response?.submitted_code ?? question.buggy_code ?? ''
  );
  const [runsRemaining, setRunsRemaining] = useState(initialRunsRemaining);
  const [running, setRunning]         = useState(false);
  const [runResults, setRunResults]   = useState<RunResult[]>([]);
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState('');
  const [activeTab, setActiveTab]     = useState<'cases' | 'output'>('cases');

  const questionOpenTime = useRef(Date.now());
  const saveTimer        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTime        = useRef(Date.now());
  const editorRef        = useRef<any>(null);

  const { meta, onKeyDown, onPaste, onRunCode } = useBehavioralTracking(questionOpenTime.current);

  // Reset on question change
  useEffect(() => {
    setCode(question.saved_response?.submitted_code ?? question.buggy_code ?? '');
    setRunResults([]);
    setActiveTab('cases');
    questionOpenTime.current = Date.now();
    startTime.current = Date.now();
    setSaveError('');
  }, [question.id]);

  // Save response (debounced)
  const saveResponse = useCallback(async (currentCode: string) => {
    setSaving(true);
    setSaveError('');
    try {
      await api.post(`/attempts/${attemptId}/responses`, {
        question_id:        question.id,
        submitted_code:     currentCode,
        language:           question.language,
        time_spent_seconds: Math.floor((Date.now() - startTime.current) / 1000),
        behavioral_meta:    meta,
      });
      onAnswered(question.id, currentCode.trim().length > 0);
    } catch {
      setSaveError('Save failed — will retry');
    } finally {
      setSaving(false);
    }
  }, [attemptId, question.id, question.language, meta]);

  function handleCodeChange(val: string | undefined) {
    const v = val ?? '';
    setCode(v);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveResponse(v), 1500);
  }

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.onKeyDown(onKeyDown);
    editor.onDidPaste(onPaste);
  };

  async function handleRun() {
    if (runsRemaining <= 0 || running) return;
    setRunning(true);
    onRunCode();
    try {
      const { data } = await api.post('/execute', {
        attempt_id:  attemptId,
        question_id: question.id,
        language:    question.language,
        code,
      });
      setRunResults(data.results ?? []);
      setRunsRemaining(data.runs_remaining ?? runsRemaining - 1);
      setActiveTab('output');
      // Save with updated test_runs_before_submit
      saveResponse(code);
    } catch (e: any) {
      if (e.response?.status === 429) {
        setRunsRemaining(0);
      }
    } finally {
      setRunning(false);
    }
  }

  const passCount = runResults.filter(r => r.passed).length;

  return (
    <div className="space-y-4">
      {/* ── Question header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: 'rgb(var(--accent))' }}>
              Q{questionNumber} · Debugging
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-mono"
              style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgb(var(--text-secondary))' }}>
              {question.language === 'cpp' ? 'C++' : 'Python'}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgb(var(--text-secondary))' }}>
              {question.marks} mark{question.marks !== 1 ? 's' : ''}
            </span>
            {saving && (
              <span className="text-xs flex items-center gap-1" style={{ color: 'rgb(var(--text-secondary))' }}>
                <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                Saving...
              </span>
            )}
            {saveError && <span className="text-xs text-red-400">{saveError}</span>}
          </div>
          <p className="text-base leading-relaxed" style={{ color: 'rgb(var(--text-primary))' }}>
            {question.statement}
          </p>
          {question.statement_image_url && (
            <img src={question.statement_image_url} alt="question"
              className="mt-3 max-h-40 rounded-xl object-contain" />
          )}
        </div>

        <button onClick={() => onToggleReview(question.id)}
          className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            backgroundColor: isMarkedForReview ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.07)',
            color: isMarkedForReview ? '#facc15' : 'rgb(var(--text-secondary))',
            border: `1px solid ${isMarkedForReview ? 'rgba(234,179,8,0.4)' : 'var(--glass-border)'}`,
          }}>
          {isMarkedForReview ? '★ Marked' : '☆ Mark'}
        </button>
      </div>

      {/* ── Split code panels ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Left: Buggy code (read-only) */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--glass-border)' }}>
          <div className="flex items-center justify-between px-3 py-2"
            style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderBottom: '1px solid var(--glass-border)' }}>
            <span className="text-xs font-semibold" style={{ color: '#f87171' }}>
              🐛 Buggy Code
            </span>
            <span className="text-xs px-2 py-0.5 rounded font-mono"
              style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgb(var(--text-secondary))' }}>
              read-only
            </span>
          </div>
          <Editor
            height="350px"
            language={lang}
            theme="vs-dark"
            value={question.buggy_code ?? ''}
            options={{ ...MONACO_OPTS, readOnly: true }}
          />
        </div>

        {/* Right: Editable fix */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(99,102,241,0.4)' }}>
          <div className="flex items-center justify-between px-3 py-2"
            style={{ backgroundColor: 'rgba(99,102,241,0.08)', borderBottom: '1px solid rgba(99,102,241,0.2)' }}>
            <span className="text-xs font-semibold" style={{ color: 'rgb(var(--accent))' }}>
              ✏️ Your Fix
            </span>
            <span className="text-xs px-2 py-0.5 rounded font-mono"
              style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: 'rgb(var(--accent))' }}>
              editable
            </span>
          </div>
          <Editor
            height="350px"
            language={lang}
            theme="vs-dark"
            value={code}
            onChange={handleCodeChange}
            onMount={handleEditorMount}
            options={{ ...MONACO_OPTS, readOnly: false }}
          />
        </div>
      </div>

      {/* ── Test cases + output panel ── */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--glass-border)' }}>
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-2"
          style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--glass-border)' }}>
          <div className="flex gap-1">
            {(['cases', 'output'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className="px-3 py-1 rounded text-xs font-medium transition-colors"
                style={{
                  backgroundColor: activeTab === t ? 'rgba(99,102,241,0.2)' : 'transparent',
                  color: activeTab === t ? 'rgb(var(--accent))' : 'rgb(var(--text-secondary))',
                }}>
                {t === 'cases' ? 'Test Cases' : `Output${runResults.length ? ` (${passCount}/${runResults.length})` : ''}`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: runsRemaining <= 3 ? '#f87171' : 'rgb(var(--text-secondary))' }}>
              Runs remaining: <span className="font-semibold">{runsRemaining}</span>
            </span>
            <button
              onClick={handleRun}
              disabled={running || runsRemaining <= 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity disabled:opacity-40"
              style={{ backgroundColor: 'rgb(var(--accent))' }}>
              {running ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Running...
                </>
              ) : runsRemaining <= 0 ? 'No runs left' : '▶ Run Code'}
            </button>
          </div>
        </div>

        {/* Tab content */}
        <div className="p-4">
          {activeTab === 'cases' ? (
            <TestCasesTab />
          ) : (
            <OutputTab results={runResults} />
          )}
        </div>
      </div>
    </div>
  );

  function TestCasesTab() {
    const [visibleCases, setVisibleCases] = useState<TestCase[]>([]);
    const [loadingCases, setLoadingCases] = useState(true);

    useEffect(() => {
      api.get(`/questions/debug/${question.id}/test-cases-visible`)
        .then(r => setVisibleCases(r.data.test_cases ?? []))
        .catch(() => setVisibleCases([]))
        .finally(() => setLoadingCases(false));
    }, []);

    if (loadingCases) return (
      <p className="text-xs text-center py-4" style={{ color: 'rgb(var(--text-secondary))' }}>Loading...</p>
    );

    return (
      <div className="space-y-3">
        {visibleCases.length === 0 ? (
          <p className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>No visible test cases.</p>
        ) : (
          visibleCases.map((tc, i) => (
            <div key={i} className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>
                  Input {i + 1}
                </p>
                <pre className="text-xs p-2 rounded-lg font-mono overflow-x-auto"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgb(var(--text-primary))' }}>
                  {tc.input || '(empty)'}
                </pre>
              </div>
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>
                  Expected Output
                </p>
                <pre className="text-xs p-2 rounded-lg font-mono overflow-x-auto"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgb(var(--text-primary))' }}>
                  {tc.expected_output}
                </pre>
              </div>
            </div>
          ))
        )}

        {/* Hidden test cases notice */}
        <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg"
          style={{ backgroundColor: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)' }}>
          <span className="text-xs" style={{ color: '#facc15' }}>🔒</span>
          <p className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
            Hidden test cases: evaluated on submit only
          </p>
        </div>
      </div>
    );
  }
}

function OutputTab({ results }: { results: RunResult[] }) {
  if (results.length === 0) {
    return (
      <p className="text-xs text-center py-4" style={{ color: 'rgb(var(--text-secondary))' }}>
        Run your code to see output here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {results.map((r, i) => (
        <div key={i} className="rounded-xl overflow-hidden"
          style={{ border: `1px solid ${r.passed ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
          <div className="flex items-center justify-between px-3 py-2"
            style={{ backgroundColor: r.passed ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.08)' }}>
            <span className="text-xs font-semibold" style={{ color: r.passed ? '#4ade80' : '#f87171' }}>
              {r.passed ? '✓ Passed' : '✗ Failed'} — Test {i + 1}
            </span>
          </div>
          <div className="p-3 grid grid-cols-3 gap-3 text-xs font-mono">
            <div>
              <p className="text-xs mb-1 font-sans" style={{ color: 'rgb(var(--text-secondary))' }}>Input</p>
              <pre className="p-2 rounded overflow-x-auto"
                style={{ backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgb(var(--text-primary))' }}>
                {r.input || '(empty)'}
              </pre>
            </div>
            <div>
              <p className="text-xs mb-1 font-sans" style={{ color: 'rgb(var(--text-secondary))' }}>Expected</p>
              <pre className="p-2 rounded overflow-x-auto"
                style={{ backgroundColor: 'rgba(255,255,255,0.04)', color: '#4ade80' }}>
                {r.expected_output}
              </pre>
            </div>
            <div>
              <p className="text-xs mb-1 font-sans" style={{ color: 'rgb(var(--text-secondary))' }}>Got</p>
              <pre className="p-2 rounded overflow-x-auto"
                style={{ backgroundColor: 'rgba(255,255,255,0.04)', color: r.passed ? '#4ade80' : '#f87171' }}>
                {r.actual_output ?? '(no output)'}
              </pre>
            </div>
          </div>
          {r.stderr && (
            <div className="px-3 pb-3">
              <p className="text-xs mb-1" style={{ color: '#f87171' }}>stderr</p>
              <pre className="text-xs p-2 rounded font-mono overflow-x-auto"
                style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#f87171' }}>
                {r.stderr}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
