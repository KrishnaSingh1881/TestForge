import { useEffect, useState } from 'react';
import api from '../../lib/axios';
import AttachToTestModal from '../../components/admin/AttachToTestModal';
import { useLenis } from '../../hooks/useLenis';
import { useOSStore } from '../store/useOSStore';

interface Test {
  id: string;
  title: string;
  subject: string;
  year: string;
  division: string;
  duration_minutes: number;
  start_time: string;
  end_time: string;
  questions_per_attempt: number;
  randomize_questions: boolean;
  status: 'draft' | 'active' | 'ended';
  created_at: string;
}

interface LeaderboardEntry {
  rank: number;
  student_name: string;
  division: string;
  score: number;
  total_marks: number;
  percentage: number;
  submitted_at: string;
}

type View = 'list' | 'create' | 'edit';

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500';
const inputStyle = {
  backgroundColor: 'rgba(255,255,255,0.07)',
  border: '1px solid var(--glass-border)',
  color: 'rgb(var(--text-primary))',
};
const labelStyle = { color: 'rgb(var(--text-secondary))' };

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    draft:  { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
    active: { bg: 'rgba(74,222,128,0.15)',  color: '#4ade80' },
    ended:  { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
  };
  const s = styles[status] ?? styles.draft;
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ backgroundColor: s.bg, color: s.color }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function TestManagerApp() {
  const lenisRef = useLenis();
  const { openWindow } = useOSStore();

  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [editing, setEditing] = useState<Test | null>(null);
  const [attachTestId, setAttachTestId] = useState<string | null>(null);
  const [leaderboardTestId, setLeaderboardTestId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [year, setYear] = useState('');
  const [division, setDivision] = useState('');
  const [duration, setDuration] = useState(60);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [questionsPerAttempt, setQuestionsPerAttempt] = useState(10);
  const [randomize, setRandomize] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await api.get('/tests');
      setTests(r.data.tests ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function loadLeaderboard(testId: string) {
    setLoadingLeaderboard(true);
    try {
      const r = await api.get(`/tests/${testId}/leaderboard`);
      setLeaderboard(r.data.leaderboard ?? []);
    } catch (e: any) {
      console.error('Failed to load leaderboard:', e);
    } finally {
      setLoadingLeaderboard(false);
    }
  }

  useEffect(() => {
    if (leaderboardTestId) {
      loadLeaderboard(leaderboardTestId);
      const interval = setInterval(() => loadLeaderboard(leaderboardTestId), 30000); // Refresh every 30s
      return () => clearInterval(interval);
    }
  }, [leaderboardTestId]);

  function resetForm() {
    setTitle('');
    setSubject('');
    setYear('');
    setDivision('');
    setDuration(60);
    setStartTime('');
    setEndTime('');
    setQuestionsPerAttempt(10);
    setRandomize(false);
    setError('');
  }

  function handleCreate() {
    resetForm();
    setEditing(null);
    setView('create');
  }

  function handleEdit(test: Test) {
    setEditing(test);
    setTitle(test.title);
    setSubject(test.subject);
    setYear(test.year);
    setDivision(test.division);
    setDuration(test.duration_minutes);
    setStartTime(test.start_time);
    setEndTime(test.end_time);
    setQuestionsPerAttempt(test.questions_per_attempt);
    setRandomize(test.randomize_questions);
    setView('edit');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!title.trim()) { setError('Title is required'); return; }
    if (!subject.trim()) { setError('Subject is required'); return; }
    if (!year) { setError('Year is required'); return; }
    if (!division) { setError('Division is required'); return; }
    if (!startTime) { setError('Start time is required'); return; }
    if (!endTime) { setError('End time is required'); return; }

    setSaving(true);
    try {
      const payload = {
        title,
        subject,
        year,
        division,
        duration_minutes: duration,
        start_time: startTime,
        end_time: endTime,
        questions_per_attempt: questionsPerAttempt,
        randomize_questions: randomize,
      };

      if (editing) {
        await api.patch(`/tests/${editing.id}`, payload);
      } else {
        await api.post('/tests', payload);
      }

      setView('list');
      resetForm();
      setEditing(null);
      load();
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this test? This cannot be undone.')) return;
    await api.delete(`/tests/${id}`);
    setTests(prev => prev.filter(t => t.id !== id));
  }

  return (
    <div ref={lenisRef} className="h-full overflow-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
            Test Manager
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgb(var(--text-secondary))' }}>
            {tests.length} test{tests.length !== 1 ? 's' : ''}
          </p>
        </div>
        {view === 'list' ? (
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleCreate}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: 'rgb(var(--accent))' }}>
              + New Test
            </button>
            <button onClick={() => openWindow('question-bank')}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-primary))' }}>
              🗃️ Question Bank
            </button>
            <button onClick={() => openWindow('test-settings')}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-primary))' }}>
              ⚙️ Test Settings
            </button>
          </div>
        ) : (
          <button onClick={() => { setView('list'); resetForm(); setEditing(null); }}
            className="px-4 py-2 rounded-lg text-sm"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
            ← Back to Tests
          </button>
        )}
      </div>

      {/* Create / Edit form */}
      {(view === 'create' || view === 'edit') && (
        <form onSubmit={handleSubmit} className="glass p-6 space-y-4">
          <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
            {view === 'edit' ? 'Edit Test' : 'New Test'}
          </h2>

          <div>
            <label className="block text-xs mb-1" style={labelStyle}>Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              className={inputCls} style={inputStyle} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={labelStyle}>Subject *</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={labelStyle}>Duration (minutes) *</label>
              <input type="number" min={1} value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                className={inputCls} style={inputStyle} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={labelStyle}>Year *</label>
              <select value={year} onChange={e => setYear(e.target.value)}
                className={inputCls} style={inputStyle}>
                <option value="" style={{ background: '#1e293b', color: '#f8fafc' }}>Select year</option>
                {['FE', 'SE', 'TE', 'BE'].map(y => <option key={y} value={y} style={{ background: '#1e293b', color: '#f8fafc' }}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={labelStyle}>Division *</label>
              <select value={division} onChange={e => setDivision(e.target.value)}
                className={inputCls} style={inputStyle}>
                <option value="" style={{ background: '#1e293b', color: '#f8fafc' }}>Select division</option>
                {['A', 'B', 'C', 'D'].map(d => <option key={d} value={d} style={{ background: '#1e293b', color: '#f8fafc' }}>{d}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={labelStyle}>Start Time *</label>
              <input type="datetime-local" value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={labelStyle}>End Time *</label>
              <input type="datetime-local" value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className={inputCls} style={inputStyle} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={labelStyle}>Questions per Attempt</label>
              <input type="number" min={1} value={questionsPerAttempt}
                onChange={e => setQuestionsPerAttempt(Number(e.target.value))}
                className={inputCls} style={inputStyle} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={randomize}
                  onChange={e => setRandomize(e.target.checked)}
                  className="accent-indigo-500" />
                <span className="text-sm" style={{ color: 'rgb(var(--text-primary))' }}>
                  Randomize questions
                </span>
              </label>
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ backgroundColor: 'rgb(var(--accent))' }}>
              {saving ? 'Saving...' : editing ? 'Update Test' : 'Create Test'}
            </button>
            {editing && (
              <button type="button" onClick={() => setAttachTestId(editing.id)}
                className="px-5 py-2 rounded-lg text-sm"
                style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
                Attach Questions
              </button>
            )}
          </div>
        </form>
      )}

      {/* Test list */}
      {view === 'list' && (
        <>
          {loading ? (
            <p className="text-sm text-center py-12" style={{ color: 'rgb(var(--text-secondary))' }}>Loading...</p>
          ) : tests.length === 0 ? (
            <div className="glass p-12 text-center">
              <p className="text-lg mb-2" style={{ color: 'rgb(var(--text-primary))' }}>No tests yet</p>
              <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                Click "New Test" to create your first test.
              </p>
            </div>
          ) : (
            <div className="glass overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    {['Test', 'Subject', 'Year/Div', 'Duration', 'Status', 'Start Time', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide"
                        style={{ color: 'rgb(var(--text-secondary))' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tests.map((t, i) => (
                    <tr key={t.id}
                      style={{ borderBottom: i < tests.length - 1 ? '1px solid var(--glass-border)' : 'none' }}>
                      <td className="px-4 py-3 font-medium max-w-xs">
                        <p className="truncate" style={{ color: 'rgb(var(--text-primary))' }}>{t.title}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: 'rgba(99,102,241,0.12)', color: 'rgb(var(--accent))' }}>
                          {t.subject}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                        {t.year} · {t.division}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                        {t.duration_minutes}m
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                        {new Date(t.start_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 flex-wrap">
                          {t.status === 'draft' && (
                            <button onClick={() => handleEdit(t)}
                              className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-80"
                              style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: 'rgb(var(--accent))' }}>
                              Edit
                            </button>
                          )}
                          <button onClick={() => openWindow('question-bank', { testId: t.id, testTitle: t.title })}
                            className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-80"
                            style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
                            Questions
                          </button>
                          {(t.status === 'active' || t.status === 'ended') && (
                            <>
                              <button onClick={() => setLeaderboardTestId(t.id)}
                                className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-80"
                                style={{ backgroundColor: 'rgba(74,222,128,0.12)', color: '#4ade80' }}>
                                Leaderboard
                              </button>
                              <button onClick={() => openWindow('integrity', { testId: t.id })}
                                className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-80"
                                style={{ backgroundColor: 'rgba(234,179,8,0.12)', color: '#facc15' }}>
                                Integrity
                              </button>
                            </>
                          )}
                          <button onClick={() => handleDelete(t.id)}
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

      {/* Leaderboard panel */}
      {leaderboardTestId && (
        <div className="glass p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
              Live Leaderboard — {tests.find(t => t.id === leaderboardTestId)?.title}
            </h3>
            <button onClick={() => setLeaderboardTestId(null)}
              className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
              ✕ Close
            </button>
          </div>

          {loadingLeaderboard ? (
            <p className="text-sm text-center py-8" style={{ color: 'rgb(var(--text-secondary))' }}>Loading...</p>
          ) : leaderboard.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'rgb(var(--text-secondary))' }}>
              No submissions yet
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--glass-border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)', backgroundColor: 'rgba(255,255,255,0.04)' }}>
                    {['Rank', 'Student', 'Division', 'Score', 'Percentage', 'Submitted'].map(h => (
                      <th key={h} className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wide"
                        style={{ color: 'rgb(var(--text-secondary))' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, i) => (
                    <tr key={i} style={{ borderBottom: i < leaderboard.length - 1 ? '1px solid var(--glass-border)' : 'none' }}>
                      <td className="px-4 py-2">
                        <span className="font-bold" style={{ color: entry.rank <= 3 ? '#facc15' : 'rgb(var(--text-secondary))' }}>
                          {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                        {entry.student_name}
                      </td>
                      <td className="px-4 py-2 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                        {entry.division}
                      </td>
                      <td className="px-4 py-2 text-xs" style={{ color: 'rgb(var(--text-primary))' }}>
                        {entry.score}/{entry.total_marks}
                      </td>
                      <td className="px-4 py-2">
                        <span className="font-semibold" style={{ color: entry.percentage >= 70 ? '#4ade80' : entry.percentage >= 50 ? '#facc15' : '#f87171' }}>
                          {entry.percentage}%
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                        {new Date(entry.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Attach modal */}
      {attachTestId && (
        <AttachToTestModal
          questionId={attachTestId}
          onClose={() => setAttachTestId(null)}
        />
      )}
    </div>
  );
}
