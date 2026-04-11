import { useEffect, useState, useRef } from 'react';
import api from '../../lib/axios';
import MCQForm from '../../components/admin/MCQForm';
import DebugQuestionForm from '../../components/admin/DebugQuestionForm';
import AttachToTestModal from '../../components/admin/AttachToTestModal';
import { useLenis } from '../../hooks/useLenis';

interface Question {
  id: string;
  type: string;
  statement: string;
  statement_image_url: string;
  topic_tag: string;
  difficulty: string;
  marks: number;
  language: string;
  created_at: string;
  mcq_options: any[];
}

interface TestQuestion {
  id: string;
  question_id: string;
  unlock_at_minutes: number;
  question_order: number;
  question_bank: Question;
}

interface ImportError { row: number | string; reason: string; }
interface ImportResult { success_count: number; error_count: number; errors: ImportError[]; }

type View = 'list' | 'create-mcq' | 'create-debug' | 'edit' | 'import';

const diffColor: Record<string, string> = {
  easy:   'rgba(34,197,94,0.15)',
  medium: 'rgba(234,179,8,0.15)',
  hard:   'rgba(239,68,68,0.15)',
};
const diffText: Record<string, string> = {
  easy: '#4ade80', medium: '#facc15', hard: '#f87171',
};

// ── Template data ─────────────────────────────────────────────
const CSV_TEMPLATE = `type,statement,option_1,option_2,option_3,option_4,correct_options,marks,topic_tag,difficulty
mcq_single,"What is the time complexity of binary search?","O(n)","O(log n)","O(n^2)","O(1)","1",2,"Algorithms","easy"
mcq_multi,"Which are sorting algorithms?","Binary Search","Merge Sort","Bubble Sort","DFS","1,2",2,"Algorithms","medium"
`;

const JSON_TEMPLATE = JSON.stringify([
  {
    type: 'mcq_single',
    statement: 'What is the time complexity of binary search?',
    options: [
      { text: 'O(n)',      is_correct: false },
      { text: 'O(log n)',  is_correct: true  },
      { text: 'O(n^2)',    is_correct: false },
      { text: 'O(1)',      is_correct: false },
    ],
    marks: 2,
    topic_tag: 'Algorithms',
    difficulty: 'easy',
  },
], null, 2);

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Drag-and-drop zone ────────────────────────────────────────
function DropZone({ onFile, disabled }: { onFile: (f: File) => void; disabled: boolean }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className="rounded-2xl flex flex-col items-center justify-center gap-3 py-14 cursor-pointer transition-all"
      style={{
        border: `2px dashed ${dragging ? 'rgb(var(--accent))' : 'var(--glass-border)'}`,
        backgroundColor: dragging ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.json"
        className="hidden"
        disabled={disabled}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      <div className="text-4xl">📂</div>
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
          Drop your CSV or JSON file here
        </p>
        <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>
          or click to browse — max 5 MB
        </p>
      </div>
      <div className="flex gap-2">
        {['.csv', '.json'].map(ext => (
          <span key={ext} className="text-xs px-2 py-0.5 rounded-full font-mono"
            style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: 'rgb(var(--accent))' }}>
            {ext}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function QuestionBankApp({ testId: initialTestId, testTitle: initialTestTitle }: { testId?: string; testTitle?: string }) {
  const lenisRef = useLenis();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [editing, setEditing] = useState<Question | null>(null);
  const [attachId, setAttachId] = useState<string | null>(null);

  // Test picker — works both when passed a testId prop and when selected manually
  const [allTests, setAllTests] = useState<{ id: string; title: string; status: string }[]>([]);
  const [selectedTestId, setSelectedTestId] = useState(initialTestId ?? '');
  const [selectedTestTitle, setSelectedTestTitle] = useState(initialTestTitle ?? '');
  const activeTestId = selectedTestId || undefined;
  const activeTestTitle = selectedTestTitle || undefined;

  // Test-questions management
  const [activeTab, setActiveTab] = useState<'bank' | 'test'>(initialTestId ? 'test' : 'bank');
  const [testQuestions, setTestQuestions] = useState<TestQuestion[]>([]);
  const [testQLoading, setTestQLoading] = useState(false);

  async function loadTestQuestions(tid = activeTestId) {
    if (!tid) return;
    setTestQLoading(true);
    try {
      const r = await api.get(`/questions/test/${tid}`);
      setTestQuestions(r.data.questions ?? []);
    } catch {
      setTestQuestions([]);
    } finally {
      setTestQLoading(false);
    }
  }

  async function handleDetach(testQuestionId: string) {
    if (!confirm('Remove this question from the test?')) return;
    await api.delete(`/questions/test-question/${testQuestionId}`);
    setTestQuestions(prev => prev.filter(tq => tq.id !== testQuestionId));
  }

  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [diffFilter, setDiffFilter] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [search, setSearch] = useState('');

  // Import state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [errorsOpen, setErrorsOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get('/questions/bank');
      setQuestions(r.data.questions ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    api.get('/tests').then(r => setAllTests(r.data.tests ?? [])).catch(() => {});
    if (initialTestId) loadTestQuestions(initialTestId);
  }, []);

  async function handleDelete(id: string) {
    if (!confirm('Delete this question? This cannot be undone.')) return;
    await api.delete(`/questions/${id}`);
    setQuestions(prev => prev.filter(q => q.id !== id));
  }

  function handleEdit(q: Question) {
    setEditing(q);
    setView('edit');
  }

  function handleSuccess() {
    setView('list');
    setEditing(null);
    load();
  }

  // Import handlers
  function handleFile(f: File) {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'json'].includes(ext ?? '')) {
      setError('Only .csv and .json files are accepted');
      return;
    }
    setFile(f);
    setResult(null);
    setError('');
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError('');
    setResult(null);

    const fd = new FormData();
    fd.append('file', file);

    try {
      const { data } = await api.post('/questions/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
      setErrorsOpen(data.error_count > 0);
      load(); // Refresh question list
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Import failed');
    } finally {
      setUploading(false);
    }
  }

  function resetImport() {
    setFile(null);
    setResult(null);
    setError('');
  }

  const typeBadge = (type: string) => (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: 'rgb(var(--accent))' }}>
      {type === 'mcq_single' ? 'MCQ Single' : type === 'mcq_multi' ? 'MCQ Multi' : 'Debugging'}
    </span>
  );

  // Filtered questions
  const filtered = questions.filter(q => {
    if (typeFilter && q.type !== typeFilter) return false;
    if (diffFilter && q.difficulty !== diffFilter) return false;
    if (topicFilter && q.topic_tag !== topicFilter) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      if (!q.statement.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const topics = [...new Set(questions.map(q => q.topic_tag).filter(Boolean))];

  const inputStyle = {
    backgroundColor: 'rgba(255,255,255,0.07)',
    border: '1px solid var(--glass-border)',
    color: 'rgb(var(--text-primary))',
  };

  return (
    <div ref={lenisRef} className="h-full overflow-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
            Question Bank
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgb(var(--text-secondary))' }}>
            {questions.length} question{questions.length !== 1 ? 's' : ''}
          </p>
        </div>
        {view === 'list' ? (
          <div className="flex gap-2">
            <button onClick={() => setView('create-mcq')}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: 'rgb(var(--accent))' }}>
              + Add MCQ
            </button>
            <button onClick={() => setView('create-debug')}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-primary))' }}>
              + Add Debugging Question
            </button>
            <button onClick={() => setView('import')}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
              📥 Bulk Import
            </button>
          </div>
        ) : (
          <button onClick={() => { setView('list'); setEditing(null); resetImport(); }}
            className="px-4 py-2 rounded-lg text-sm"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
            ← Back to Bank
          </button>
        )}
      </div>

      {/* Test picker + tab bar */}
      <div className="glass p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48">
          <label className="block text-xs mb-1 font-medium uppercase tracking-wide"
            style={{ color: 'rgb(var(--text-secondary))' }}>Manage questions for test</label>
          <select
            value={selectedTestId}
            onChange={e => {
              const tid = e.target.value;
              const t = allTests.find(x => x.id === tid);
              setSelectedTestId(tid);
              setSelectedTestTitle(t?.title ?? '');
              if (tid) { setActiveTab('test'); loadTestQuestions(tid); }
              else setActiveTab('bank');
            }}
            className="w-full px-3 py-1.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-primary))' }}
          >
            <option value="">— No test selected (browse all questions) —</option>
            {allTests.map(t => <option key={t.id} value={t.id}>{t.title} ({t.status})</option>)}
          </select>
        </div>

        {activeTestId && (
          <div className="flex gap-1 p-1 rounded-xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}>
            {(['test', 'bank'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: activeTab === tab ? 'rgb(var(--accent))' : 'transparent',
                  color: activeTab === tab ? '#fff' : 'rgb(var(--text-secondary))',
                }}>
                {tab === 'test' ? `📋 Test Questions` : '🗃️ All Questions'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Test questions management panel */}
      {activeTab === 'test' && activeTestId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
              {testQuestions.length} question{testQuestions.length !== 1 ? 's' : ''} attached — {activeTestTitle}
            </p>
            <button onClick={() => setActiveTab('bank')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ backgroundColor: 'rgb(var(--accent))' }}>
              + Add from Bank
            </button>
          </div>

          {testQLoading ? (
            <p className="text-sm text-center py-8" style={{ color: 'rgb(var(--text-secondary))' }}>Loading...</p>
          ) : testQuestions.length === 0 ? (
            <div className="glass p-10 text-center">
              <p className="text-base mb-1" style={{ color: 'rgb(var(--text-primary))' }}>No questions attached</p>
              <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                Switch to "All Questions" tab and click "Attach" on any question.
              </p>
            </div>
          ) : (
            <div className="glass overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    {['#', 'Question', 'Type', 'Marks', 'Unlocks at', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide"
                        style={{ color: 'rgb(var(--text-secondary))' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {testQuestions.sort((a, b) => a.question_order - b.question_order).map((tq, i) => {
                    const q = tq.question_bank;
                    return (
                      <tr key={tq.id} style={{ borderBottom: i < testQuestions.length - 1 ? '1px solid var(--glass-border)' : 'none' }}>
                        <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>{tq.question_order + 1}</td>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="truncate" style={{ color: 'rgb(var(--text-primary))' }}>{q?.statement ?? '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: 'rgb(var(--accent))' }}>
                            {q?.type === 'mcq_single' ? 'MCQ' : q?.type === 'mcq_multi' ? 'MCQ Multi' : 'Debug'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-primary))' }}>{q?.marks ?? '—'}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                          {tq.unlock_at_minutes === 0 ? 'Immediately' : `${tq.unlock_at_minutes}m`}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleDetach(tq.id)}
                            className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-80"
                            style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Show bank content only when on bank tab */}
      {activeTab === 'bank' && (<>
      {(view === 'create-mcq' || view === 'edit') && (
        <div className="glass p-6">
          <h2 className="text-lg font-semibold mb-5" style={{ color: 'rgb(var(--text-primary))' }}>
            {view === 'edit' ? 'Edit Question' : 'New MCQ Question'}
          </h2>
          <MCQForm
            onSuccess={handleSuccess}
            initial={editing ? {
              id: editing.id,
              type: editing.type as 'mcq_single' | 'mcq_multi',
              statement: editing.statement,
              statement_image_url: editing.statement_image_url,
              topic_tag: editing.topic_tag,
              difficulty: editing.difficulty,
              marks: editing.marks,
              mcq_options: editing.mcq_options,
            } : undefined}
          />
        </div>
      )}

      {/* Create Debugging Question form */}
      {view === 'create-debug' && (
        <DebugQuestionForm onSuccess={handleSuccess} />
      )}

      {/* Bulk Import view */}
      {view === 'import' && (
        <div className="space-y-6">
          {/* Template downloads */}
          <div className="glass p-5">
            <p className="text-xs font-medium uppercase tracking-wide mb-3"
              style={{ color: 'rgb(var(--text-secondary))' }}>
              Download Templates
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => downloadFile(CSV_TEMPLATE, 'testforge_questions_template.csv', 'text/csv')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
                ⬇ CSV Template
              </button>
              <button
                onClick={() => downloadFile(JSON_TEMPLATE, 'testforge_questions_template.json', 'application/json')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'rgba(99,102,241,0.12)', color: 'rgb(var(--accent))', border: '1px solid rgba(99,102,241,0.3)' }}>
                ⬇ JSON Template
              </button>
            </div>
          </div>

          {/* Drop zone */}
          <div className="glass p-6 space-y-4">
            <DropZone onFile={handleFile} disabled={uploading} />

            {/* Selected file indicator */}
            {file && !result && (
              <div className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ backgroundColor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-lg">{file.name.endsWith('.csv') ? '📊' : '📋'}</span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>{file.name}</p>
                    <p className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button onClick={resetImport} className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>✕ Remove</button>
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            {file && !result && (
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: 'rgb(var(--accent))' }}>
                {uploading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Importing...
                  </>
                ) : 'Import Questions'}
              </button>
            )}
          </div>

          {/* Results panel */}
          {result && (
            <div className="glass p-6 space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl p-4 text-center"
                  style={{ backgroundColor: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)' }}>
                  <p className="text-3xl font-bold" style={{ color: '#4ade80' }}>{result.success_count}</p>
                  <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>
                    Questions imported
                  </p>
                </div>
                <div className="rounded-xl p-4 text-center"
                  style={{
                    backgroundColor: result.error_count > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${result.error_count > 0 ? 'rgba(239,68,68,0.25)' : 'var(--glass-border)'}`,
                  }}>
                  <p className="text-3xl font-bold" style={{ color: result.error_count > 0 ? '#f87171' : 'rgb(var(--text-secondary))' }}>
                    {result.error_count}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>
                    Rows failed
                  </p>
                </div>
              </div>

              {/* Error table */}
              {result.error_count > 0 && (
                <div>
                  <button
                    onClick={() => setErrorsOpen(v => !v)}
                    className="flex items-center gap-2 text-sm font-medium w-full text-left py-2"
                    style={{ color: '#f87171' }}>
                    <span>{errorsOpen ? '▼' : '▶'}</span>
                    {result.error_count} failed row{result.error_count !== 1 ? 's' : ''} — click to {errorsOpen ? 'hide' : 'show'}
                  </button>

                  {errorsOpen && (
                    <div className="rounded-xl overflow-hidden mt-1"
                      style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ backgroundColor: 'rgba(239,68,68,0.08)' }}>
                            <th className="text-left px-4 py-2 font-medium w-16"
                              style={{ color: '#f87171' }}>Row</th>
                            <th className="text-left px-4 py-2 font-medium"
                              style={{ color: '#f87171' }}>Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.errors.map((e, i) => (
                            <tr key={i} style={{ borderTop: '1px solid rgba(239,68,68,0.1)' }}>
                              <td className="px-4 py-2 font-mono" style={{ color: 'rgb(var(--text-secondary))' }}>
                                {e.row}
                              </td>
                              <td className="px-4 py-2" style={{ color: 'rgb(var(--text-primary))' }}>
                                {e.reason}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setView('list'); resetImport(); }}
                  className="px-5 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: 'rgb(var(--accent))' }}>
                  View in Question Bank →
                </button>
                <button onClick={resetImport}
                  className="px-5 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
                  Import Another File
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Question list */}
      {view === 'list' && (
        <>
          {/* Filter bar */}
          <div className="glass p-4 flex flex-wrap gap-3 items-center">
            <input
              type="text"
              placeholder="Search questions..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-48"
              style={inputStyle}
            />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              style={inputStyle}>
              <option value="">All Types</option>
              <option value="mcq_single">MCQ Single</option>
              <option value="mcq_multi">MCQ Multi</option>
              <option value="debugging">Debugging</option>
            </select>
            <select value={diffFilter} onChange={e => setDiffFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              style={inputStyle}>
              <option value="">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <select value={topicFilter} onChange={e => setTopicFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              style={inputStyle}>
              <option value="">All Topics</option>
              {topics.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="ml-auto text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
              {filtered.length} question{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          {loading ? (
            <p className="text-sm text-center py-12" style={{ color: 'rgb(var(--text-secondary))' }}>Loading...</p>
          ) : filtered.length === 0 ? (
            <div className="glass p-12 text-center">
              <p className="text-lg mb-2" style={{ color: 'rgb(var(--text-primary))' }}>No questions found</p>
              <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                {questions.length === 0 ? 'Click "Add MCQ" or "Add Debugging Question" to get started.' : 'Try adjusting your filters.'}
              </p>
            </div>
          ) : (
            <div className="glass overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    {['Question', 'Type', 'Topic', 'Difficulty', 'Marks', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide"
                        style={{ color: 'rgb(var(--text-secondary))' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((q, i) => (
                    <tr key={q.id}
                      style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--glass-border)' : 'none' }}>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="truncate" style={{ color: 'rgb(var(--text-primary))' }}>
                          {q.statement}
                        </p>
                      </td>
                      <td className="px-4 py-3">{typeBadge(q.type)}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                          {q.topic_tag || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {q.difficulty ? (
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: diffColor[q.difficulty], color: diffText[q.difficulty] }}>
                            {q.difficulty}
                          </span>
                        ) : <span style={{ color: 'rgb(var(--text-secondary))' }}>—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs" style={{ color: 'rgb(var(--text-primary))' }}>{q.marks}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {q.type !== 'debugging' && (
                            <button onClick={() => handleEdit(q)}
                              className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-80"
                              style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: 'rgb(var(--accent))' }}>
                              Edit
                            </button>
                          )}
                          <button onClick={() => setAttachId(q.id)}
                            className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-80"
                            style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
                            Attach
                          </button>
                          <button onClick={() => handleDelete(q.id)}
                            className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-80"
                            style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Attach modal */}
      {attachId && (
        <AttachToTestModal
          questionId={attachId}
          preselectedTestId={activeTestId}
          onClose={() => { setAttachId(null); if (activeTestId) loadTestQuestions(activeTestId); }}
        />
      )}
    </div>
  );
}
