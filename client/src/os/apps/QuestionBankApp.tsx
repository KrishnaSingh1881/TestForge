import { useEffect, useState } from 'react';
import api from '../../lib/axios';
import MCQForm from '../../components/admin/MCQForm';
import DebugQuestionForm from '../../components/admin/DebugQuestionForm';

interface Test { id: string; title: string; subject: string; status: string; }
interface Question {
  id: string; type: string; statement: string; statement_image_url: string;
  topic_tag: string; difficulty: string; marks: number; language: string;
  created_at: string; mcq_options: any[];
}
interface TestQuestion {
  id: string; question_id: string; unlock_at_minutes: number;
  question_order: number; question_bank: Question;
}

type Screen = 'pick-test' | 'test-questions' | 'add-question' | 'pick-type' | 'create-mcq' | 'create-debug' | 'create-coding' | 'edit-mcq' | 'bulk-import';

const diffColor: Record<string, string> = { easy: 'rgba(34,197,94,0.15)', medium: 'rgba(234,179,8,0.15)', hard: 'rgba(239,68,68,0.15)' };
const diffText:  Record<string, string> = { easy: '#4ade80', medium: '#facc15', hard: '#f87171' };

const statusColor: Record<string, string> = { draft: '#94a3b8', active: '#4ade80', ended: '#f87171' };

function TypeBadge({ type }: { type: string }) {
  const label = type === 'mcq_single' ? 'MCQ' : type === 'mcq_multi' ? 'MCQ Multi' : 'Debug';
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: 'rgb(var(--accent))' }}>
      {label}
    </span>
  );
}

export default function QuestionBankApp({ testId: initTestId, testTitle: initTestTitle }: { testId?: string; testTitle?: string }) {
  const [screen, setScreen] = useState<Screen>(initTestId ? 'test-questions' : 'pick-test');
  const [tests, setTests] = useState<Test[]>([]);
  const [testsLoading, setTestsLoading] = useState(true);

  const [activeTest, setActiveTest] = useState<Test | null>(null);
  const [testQuestions, setTestQuestions] = useState<TestQuestion[]>([]);
  const [tqLoading, setTqLoading] = useState(false);

  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [aqLoading, setAqLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [editingQ, setEditingQ] = useState<Question | null>(null);
  const [attachingQ, setAttachingQ] = useState<Question | null>(null);
  const [unlockAt, setUnlockAt] = useState(0);
  const [attaching, setAttaching] = useState(false);

  // Bulk import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success_count: number; error_count: number; errors: any[] } | null>(null);
  const [importError, setImportError] = useState('');

  const inputStyle = {
    backgroundColor: 'rgba(255,255,255,0.07)',
    border: '1px solid var(--glass-border)',
    color: 'rgb(var(--text-primary))',
  };

  // Load tests
  useEffect(() => {
    api.get('/tests')
      .then(r => setTests(r.data.tests ?? []))
      .finally(() => setTestsLoading(false));
  }, []);

  // If opened with a testId prop, load that test
  useEffect(() => {
    if (initTestId && tests.length > 0) {
      const t = tests.find(x => x.id === initTestId);
      if (t) selectTest(t);
    }
  }, [initTestId, tests]);

  async function selectTest(t: Test) {
    setActiveTest(t);
    setScreen('test-questions');
    setTqLoading(true);
    try {
      const r = await api.get(`/questions/test/${t.id}`);
      setTestQuestions(r.data.questions ?? []);
    } finally {
      setTqLoading(false);
    }
  }

  async function loadAllQuestions() {
    setAqLoading(true);
    try {
      const r = await api.get('/questions/bank');
      setAllQuestions(r.data.questions ?? []);
    } finally {
      setAqLoading(false);
    }
  }

  async function handleDetach(tqId: string) {
    if (!confirm('Remove this question from the test?')) return;
    await api.delete(`/questions/test-question/${tqId}`);
    setTestQuestions(prev => prev.filter(q => q.id !== tqId));
  }

  async function handleAttach(q: Question) {
    if (!activeTest) return;
    setAttachingQ(q);
  }

  async function confirmAttach() {
    if (!attachingQ || !activeTest) return;
    setAttaching(true);
    try {
      await api.post(`/questions/${attachingQ.id}/attach`, {
        test_id: activeTest.id,
        unlock_at_minutes: unlockAt,
        question_order: testQuestions.length,
      });
      const r = await api.get(`/questions/test/${activeTest.id}`);
      setTestQuestions(r.data.questions ?? []);
      setAttachingQ(null);
      setUnlockAt(0);
      setScreen('test-questions');
    } catch (e: any) {
      alert(e.response?.data?.error ?? 'Failed to attach');
    } finally {
      setAttaching(false);
    }
  }

  async function handleDeleteQuestion(id: string) {
    if (!confirm('Delete this question permanently?')) return;
    await api.delete(`/questions/${id}`);
    setAllQuestions(prev => prev.filter(q => q.id !== id));
  }

  const [addingAll, setAddingAll] = useState(false);

  async function handleAddAll() {
    if (!activeTest) return;
    const unattached = filtered.filter(q => !testQuestions.some(tq => tq.question_id === q.id));
    if (unattached.length === 0) return;
    if (!confirm(`Add all ${unattached.length} questions to this test?`)) return;
    setAddingAll(true);
    try {
      for (let i = 0; i < unattached.length; i++) {
        await api.post(`/questions/${unattached[i].id}/attach`, {
          test_id: activeTest.id,
          unlock_at_minutes: 0,
          question_order: testQuestions.length + i,
        });
      }
      const r = await api.get(`/questions/test/${activeTest.id}`);
      setTestQuestions(r.data.questions ?? []);
      setScreen('test-questions');
    } catch (e: any) {
      alert(e.response?.data?.error ?? 'Failed to add all');
    } finally {
      setAddingAll(false);
    }
  }

  async function handleBulkImport() {
    if (!importFile) return;
    setImporting(true);
    setImportError('');
    setImportResult(null);
    const fd = new FormData();
    fd.append('file', importFile);
    try {
      const { data } = await api.post('/questions/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setImportResult(data);
      loadAllQuestions();
    } catch (e: any) {
      setImportError(e.response?.data?.error ?? 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  function goAddQuestion() {
    loadAllQuestions();
    setScreen('add-question');
  }

  const filtered = allQuestions.filter(q => {
    if (typeFilter && q.type !== typeFilter) return false;
    if (search.trim() && !q.statement.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ── Screen: Pick Test ──────────────────────────────────────
  if (screen === 'pick-test') {
    return (
      <div className="h-full overflow-auto flex flex-col">
        {/* Header */}
        <div className="p-6 pb-4">
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>Question Bank</h1>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>Select a test to manage its questions</p>
        </div>

        {/* Test grid */}
        <div className="flex-1 p-6 pt-2">
          {testsLoading ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Loading tests...</p>
            </div>
          ) : tests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="text-5xl">🗓️</div>
              <p className="text-base font-medium" style={{ color: 'rgb(var(--text-primary))' }}>No tests yet</p>
              <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Create a test in Test Manager first</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {tests.map(t => (
                <button key={t.id} onClick={() => selectTest(t)}
                  className="glass p-5 text-left rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ border: '1px solid var(--glass-border)' }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-2xl">📋</div>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: `${statusColor[t.status]}22`, color: statusColor[t.status] }}>
                      {t.status}
                    </span>
                  </div>
                  <p className="font-semibold text-sm truncate" style={{ color: 'rgb(var(--text-primary))' }}>{t.title}</p>
                  <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>{t.subject}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Screen: Test Questions ─────────────────────────────────
  if (screen === 'test-questions') {
    return (
      <div className="h-full overflow-auto flex flex-col">
        {/* Header */}
        <div className="p-6 pb-4 flex items-center gap-3">
          <button onClick={() => setScreen('pick-test')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-opacity hover:opacity-70"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
            ←
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{activeTest?.title}</h1>
            <p className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>{activeTest?.subject} · {testQuestions.length} questions</p>
          </div>
          <button onClick={goAddQuestion}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: 'rgb(var(--accent))' }}>
            + Add Question
          </button>
        </div>

        {/* Questions list */}
        <div className="flex-1 px-6 pb-6">
          {tqLoading ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Loading...</p>
            </div>
          ) : testQuestions.length === 0 ? (
            <div className="glass rounded-2xl flex flex-col items-center justify-center py-16 gap-4">
              <div className="text-5xl">📭</div>
              <p className="text-base font-medium" style={{ color: 'rgb(var(--text-primary))' }}>No questions yet</p>
              <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Click "Add Question" to attach questions to this test</p>
              <button onClick={goAddQuestion}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white mt-2"
                style={{ backgroundColor: 'rgb(var(--accent))' }}>
                + Add Question
              </button>
            </div>
          ) : (
            <div className="glass overflow-hidden rounded-2xl">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)', backgroundColor: 'rgba(255,255,255,0.03)' }}>
                    {['#', 'Question', 'Type', 'Marks', 'Unlocks', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide"
                        style={{ color: 'rgb(var(--text-secondary))' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...testQuestions].sort((a, b) => a.question_order - b.question_order).map((tq, i) => {
                    const q = tq.question_bank;
                    return (
                      <tr key={tq.id} style={{ borderBottom: i < testQuestions.length - 1 ? '1px solid var(--glass-border)' : 'none' }}>
                        <td className="px-4 py-3 text-xs font-mono" style={{ color: 'rgb(var(--text-secondary))' }}>{i + 1}</td>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="truncate text-sm" style={{ color: 'rgb(var(--text-primary))' }}>{q?.statement ?? '—'}</p>
                        </td>
                        <td className="px-4 py-3"><TypeBadge type={q?.type ?? ''} /></td>
                        <td className="px-4 py-3 text-xs font-medium" style={{ color: 'rgb(var(--text-primary))' }}>{q?.marks ?? '—'}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                          {tq.unlock_at_minutes === 0 ? 'Start' : `+${tq.unlock_at_minutes}m`}
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
      </div>
    );
  }

  // ── Screen: Add Question (browse bank) ────────────────────
  if (screen === 'add-question') {
    return (
      <div className="h-full overflow-auto flex flex-col">
        {/* Header */}
        <div className="p-6 pb-4 flex items-center gap-3">
          <button onClick={() => setScreen('test-questions')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-opacity hover:opacity-70"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
            ←
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>Add Question</h1>
            <p className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>Pick from bank or create new</p>
          </div>
          <button onClick={() => setScreen('pick-type')}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: 'rgb(var(--accent))' }}>
            + Create New
          </button>
          {filtered.some(q => !testQuestions.some(tq => tq.question_id === q.id)) && (
            <button onClick={handleAddAll} disabled={addingAll}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: '#4ade80', color: '#000' }}>
              {addingAll ? 'Adding...' : `+ Add All (${filtered.filter(q => !testQuestions.some(tq => tq.question_id === q.id)).length})`}
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="px-6 pb-3 flex gap-2 flex-wrap">
          <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-44"
            style={inputStyle} />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            style={inputStyle}>
            <option value="">All Types</option>
            <option value="mcq_single">MCQ Single</option>
            <option value="mcq_multi">MCQ Multi</option>
            <option value="debugging">Debugging</option>
          </select>
          <span className="ml-auto text-xs self-center" style={{ color: 'rgb(var(--text-secondary))' }}>
            {filtered.length} questions
          </span>
        </div>

        {/* Question list */}
        <div className="flex-1 px-6 pb-6">
          {aqLoading ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>Loading...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass rounded-2xl flex flex-col items-center justify-center py-12 gap-3">
              <p className="text-base" style={{ color: 'rgb(var(--text-primary))' }}>No questions in bank</p>
              <button onClick={() => setScreen('pick-type')}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: 'rgb(var(--accent))' }}>
                Create your first question
              </button>
            </div>
          ) : (
            <div className="glass overflow-hidden rounded-2xl">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)', backgroundColor: 'rgba(255,255,255,0.03)' }}>
                    {['Question', 'Type', 'Difficulty', 'Marks', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide"
                        style={{ color: 'rgb(var(--text-secondary))' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((q, i) => {
                    const alreadyAttached = testQuestions.some(tq => tq.question_id === q.id);
                    return (
                      <tr key={q.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--glass-border)' : 'none' }}>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="truncate" style={{ color: 'rgb(var(--text-primary))' }}>{q.statement}</p>
                        </td>
                        <td className="px-4 py-3"><TypeBadge type={q.type} /></td>
                        <td className="px-4 py-3">
                          {q.difficulty ? (
                            <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: diffColor[q.difficulty], color: diffText[q.difficulty] }}>
                              {q.difficulty}
                            </span>
                          ) : <span style={{ color: 'rgb(var(--text-secondary))' }}>—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-primary))' }}>{q.marks}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            {alreadyAttached ? (
                              <span className="text-xs px-2 py-1 rounded"
                                style={{ backgroundColor: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
                                ✓ Added
                              </span>
                            ) : (
                              <button onClick={() => handleAttach(q)}
                                className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-80 text-white"
                                style={{ backgroundColor: 'rgb(var(--accent))' }}>
                                + Add
                              </button>
                            )}
                            <button onClick={() => handleDeleteQuestion(q.id)}
                              className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-80"
                              style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Attach confirm modal */}
        {attachingQ && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
            <div className="glass w-full max-w-sm p-6 rounded-2xl space-y-4">
              <h3 className="font-bold text-base" style={{ color: 'rgb(var(--text-primary))' }}>Add to Test</h3>
              <p className="text-sm truncate" style={{ color: 'rgb(var(--text-secondary))' }}>{attachingQ.statement}</p>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>Unlock after (minutes)</label>
                <input type="number" min={0} value={unlockAt} onChange={e => setUnlockAt(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  style={inputStyle} />
                <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>0 = available immediately</p>
              </div>
              <div className="flex gap-3">
                <button onClick={confirmAttach} disabled={attaching}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: 'rgb(var(--accent))' }}>
                  {attaching ? 'Adding...' : 'Add to Test'}
                </button>
                <button onClick={() => setAttachingQ(null)}
                  className="px-4 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Screen: Pick Type ──────────────────────────────────────
  if (screen === 'pick-type') {
    return (
      <div className="h-full overflow-auto flex flex-col">
        <div className="p-6 pb-4 flex items-center gap-3">
          <button onClick={() => setScreen('add-question')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-opacity hover:opacity-70"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
            ←
          </button>
          <h1 className="text-xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>Choose Question Type</h1>
        </div>

        <div className="flex-1 p-6 pt-2 flex flex-col gap-3 max-w-lg mx-auto w-full">
          {[
            { type: 'create-mcq' as Screen, icon: '☑️', title: 'Multiple Choice', desc: 'Single or multi-select options with correct answers' },
            { type: 'create-debug' as Screen, icon: '🐛', title: 'Debugging Question', desc: 'Students fix buggy code — AI generates variants' },
            { type: 'create-coding' as Screen, icon: '💻', title: 'Coding Question', desc: 'Students write code from scratch with test cases' },
            { type: 'bulk-import' as Screen, icon: '📥', title: 'Bulk Import', desc: 'Import multiple MCQ questions from CSV or JSON file' },
          ].map(opt => (
            <button key={opt.type} onClick={() => { setImportFile(null); setImportResult(null); setImportError(''); setScreen(opt.type); }}
              className="glass p-5 rounded-2xl text-left transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center gap-4"
              style={{ border: '1px solid var(--glass-border)' }}>
              <div className="text-3xl">{opt.icon}</div>
              <div className="flex-1">
                <p className="font-semibold text-sm" style={{ color: 'rgb(var(--text-primary))' }}>{opt.title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-secondary))' }}>{opt.desc}</p>
              </div>
              <span className="text-lg" style={{ color: 'rgb(var(--text-secondary))' }}>→</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Screen: Create MCQ ─────────────────────────────────────
  if (screen === 'create-mcq' || screen === 'edit-mcq') {
    return (
      <div className="h-full overflow-auto flex flex-col">
        <div className="p-6 pb-4 flex items-center gap-3">
          <button onClick={() => setScreen(screen === 'edit-mcq' ? 'add-question' : 'pick-type')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-opacity hover:opacity-70"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
            ←
          </button>
          <h1 className="text-xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
            {screen === 'edit-mcq' ? 'Edit Question' : 'New MCQ Question'}
          </h1>
        </div>
        <div className="flex-1 px-6 pb-6">
          <div className="glass p-6 rounded-2xl">
            <MCQForm
              onSuccess={() => { setEditingQ(null); loadAllQuestions(); setScreen('add-question'); }}
              initial={editingQ ? {
                id: editingQ.id, type: editingQ.type as 'mcq_single' | 'mcq_multi',
                statement: editingQ.statement, statement_image_url: editingQ.statement_image_url,
                topic_tag: editingQ.topic_tag, difficulty: editingQ.difficulty,
                marks: editingQ.marks, mcq_options: editingQ.mcq_options,
              } : undefined}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Screen: Create Debug ───────────────────────────────────
  if (screen === 'create-debug') {
    return (
      <div className="h-full overflow-auto flex flex-col">
        <div className="p-6 pb-4 flex items-center gap-3">
          <button onClick={() => setScreen('pick-type')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-opacity hover:opacity-70"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
            ←
          </button>
          <h1 className="text-xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>New Debugging Question</h1>
        </div>
        <div className="flex-1 px-6 pb-6">
          <DebugQuestionForm onSuccess={() => { loadAllQuestions(); setScreen('add-question'); }} />
        </div>
      </div>
    );
  }

  // ── Screen: Create Coding Question ────────────────────────
  if (screen === 'create-coding') {
    return (
      <div className="h-full overflow-auto flex flex-col">
        <div className="p-6 pb-4 flex items-center gap-3">
          <button onClick={() => setScreen('pick-type')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-opacity hover:opacity-70"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
            ←
          </button>
          <h1 className="text-xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>New Coding Question</h1>
        </div>
        <div className="flex-1 px-6 pb-6">
          <DebugQuestionForm
            onSuccess={() => { loadAllQuestions(); setScreen('add-question'); }}
          />
        </div>
      </div>
    );
  }

  // ── Screen: Bulk Import ────────────────────────────────────
  if (screen === 'bulk-import') {
    const CSV_TEMPLATE = `type,statement,option_1,option_2,option_3,option_4,correct_options,marks,topic_tag,difficulty\nmcq_single,"What is O(log n)?","Binary Search","Bubble Sort","Linear Search","DFS","1",2,"Algorithms","easy"\n`;
    const JSON_TEMPLATE = JSON.stringify([{ type: 'mcq_single', statement: 'What is O(log n)?', options: [{ text: 'Binary Search', is_correct: true }, { text: 'Bubble Sort', is_correct: false }], marks: 2, topic_tag: 'Algorithms', difficulty: 'easy' }], null, 2);

    function dl(content: string, name: string, mime: string) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([content], { type: mime }));
      a.download = name; a.click();
    }

    return (
      <div className="h-full overflow-auto flex flex-col">
        <div className="p-6 pb-4 flex items-center gap-3">
          <button onClick={() => setScreen('pick-type')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-opacity hover:opacity-70"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
            ←
          </button>
          <h1 className="text-xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>Bulk Import</h1>
        </div>

        <div className="flex-1 px-6 pb-6 space-y-4">
          {/* Templates */}
          <div className="glass p-5 rounded-2xl">
            <p className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'rgb(var(--text-secondary))' }}>Download Templates</p>
            <div className="flex gap-3">
              <button onClick={() => dl(CSV_TEMPLATE, 'questions_template.csv', 'text/csv')}
                className="px-4 py-2 rounded-lg text-sm transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
                ⬇ CSV Template
              </button>
              <button onClick={() => dl(JSON_TEMPLATE, 'questions_template.json', 'application/json')}
                className="px-4 py-2 rounded-lg text-sm transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'rgba(99,102,241,0.12)', color: 'rgb(var(--accent))', border: '1px solid rgba(99,102,241,0.3)' }}>
                ⬇ JSON Template
              </button>
            </div>
          </div>

          {/* Drop zone */}
          <div className="glass p-6 rounded-2xl space-y-4">
            <label className="rounded-xl flex flex-col items-center justify-center gap-3 py-10 cursor-pointer transition-all"
              style={{ border: '2px dashed var(--glass-border)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <input type="file" accept=".csv,.json" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) { setImportFile(f); setImportResult(null); setImportError(''); } }} />
              <div className="text-4xl">📂</div>
              <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                {importFile ? importFile.name : 'Drop CSV or JSON here, or click to browse'}
              </p>
              <div className="flex gap-2">
                {['.csv', '.json'].map(e => (
                  <span key={e} className="text-xs px-2 py-0.5 rounded-full font-mono"
                    style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: 'rgb(var(--accent))' }}>{e}</span>
                ))}
              </div>
            </label>

            {importError && <p className="text-sm text-red-400">{importError}</p>}

            {importFile && !importResult && (
              <button onClick={handleBulkImport} disabled={importing}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: 'rgb(var(--accent))' }}>
                {importing ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Importing...</> : 'Import Questions'}
              </button>
            )}
          </div>

          {/* Result */}
          {importResult && (
            <div className="glass p-5 rounded-2xl space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-4 text-center" style={{ backgroundColor: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)' }}>
                  <p className="text-3xl font-bold" style={{ color: '#4ade80' }}>{importResult.success_count}</p>
                  <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>Imported</p>
                </div>
                <div className="rounded-xl p-4 text-center" style={{ backgroundColor: importResult.error_count > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${importResult.error_count > 0 ? 'rgba(239,68,68,0.25)' : 'var(--glass-border)'}` }}>
                  <p className="text-3xl font-bold" style={{ color: importResult.error_count > 0 ? '#f87171' : 'rgb(var(--text-secondary))' }}>{importResult.error_count}</p>
                  <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>Failed</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setScreen('add-question'); }}
                  className="px-5 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: 'rgb(var(--accent))' }}>
                  View Questions →
                </button>
                <button onClick={() => { setImportFile(null); setImportResult(null); }}
                  className="px-4 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
                  Import More
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
