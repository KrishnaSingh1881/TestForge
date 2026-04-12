import { useEffect, useState, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import api from '../../lib/axios';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useOSStore } from '../store/useOSStore';
import AnimatedList from '../../components/AnimatedList';
import {
  FiArrowLeft, FiSearch, FiChevronRight, FiCalendar, FiClock,
  FiActivity, FiAward, FiCheckCircle, FiShield, FiBarChart2,
  FiSlash, FiUsers, FiFileText, FiList,
} from 'react-icons/fi';

interface ResultsAppProps {
  testId?: string;
  testTitle?: string;
  attemptId?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function gradeBand(pct: number) {
  if (pct >= 90) return { grade: 'A+', color: '#4ade80' };
  if (pct >= 80) return { grade: 'A',  color: '#4ade80' };
  if (pct >= 70) return { grade: 'B',  color: '#86efac' };
  if (pct >= 60) return { grade: 'C',  color: '#facc15' };
  if (pct >= 40) return { grade: 'D',  color: '#fb923c' };
  return { grade: 'F', color: '#f87171' };
}

function pctColor(pct: number) {
  if (pct >= 70) return '#4ade80';
  if (pct >= 40) return '#facc15';
  return '#f87171';
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

function ScoreCircle({ score, total, pct }: { score: number; total: number; pct: number }) {
  const { grade, color } = gradeBand(pct);
  const r = 54, circ = 2 * Math.PI * r;
  return (
    <div className="relative w-40 h-40 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${(pct / 100) * circ} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black" style={{ color }}>{grade}</span>
        <span className="text-xs font-black text-secondary opacity-40">{score}/{total}</span>
      </div>
    </div>
  );
}

// ── Student: ResultDetailView ─────────────────────────────────────────────────
function ResultDetailView({ attemptId, monacoTheme, onBack }: { attemptId: string; monacoTheme: string; onBack: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/attempts/${attemptId}/result`)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error ?? 'Failed to load result'))
      .finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );
  if (error) return (
    <div className="h-full flex items-center justify-center flex-col gap-3">
      <FiBarChart2 className="text-4xl text-white/10" />
      <p className="text-red-400 font-bold text-sm">{error}</p>
    </div>
  );
  if (!data) return null;

  const { result, attempt, breakdown, section_scores } = data;
  const { grade, color: gradeColor } = gradeBand(result.percentage ?? 0);

  return (
    <div className="p-8 space-y-8 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-6">
      {/* Score hero */}
      <div className="glass no-shadow p-10 rounded-[3rem] border-white/5 flex flex-col md:flex-row items-center gap-10">
        <ScoreCircle score={result.total_score} total={result.total_marks} pct={result.percentage} />
        <div className="flex-1 space-y-3 text-center md:text-left">
          <h2 className="text-3xl font-black text-primary tracking-tight uppercase">{attempt.test_title}</h2>
          <p className="text-[10px] font-black text-secondary uppercase tracking-widest opacity-40">{attempt.test_subject}</p>
          <div className="flex flex-wrap gap-3 justify-center md:justify-start mt-4">
            {[
              { icon: FiAward, label: 'Rank', val: result.rank ? `#${result.rank}` : '—' },
              { icon: FiClock, label: 'Time', val: attempt.time_taken_mins ? `${attempt.time_taken_mins}m` : '—' },
              { icon: FiCalendar, label: 'Submitted', val: fmtDate(attempt.submitted_at) },
            ].map(({ icon: Icon, label, val }) => (
              <div key={label} className="glass no-shadow px-5 py-3 rounded-2xl border-white/5 flex items-center gap-3">
                <Icon className="text-indigo-400 text-sm" />
                <div>
                  <p className="text-[8px] font-black text-secondary uppercase tracking-widest opacity-40">{label}</p>
                  <p className="text-sm font-black text-primary">{val}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section breakdown */}
      {section_scores && (
        <div className="grid grid-cols-2 gap-4">
          {[{ label: 'MCQ', score: section_scores.mcqScore, total: section_scores.mcqTotal },
            { label: 'Debugging', score: section_scores.debugScore, total: section_scores.debugTotal }]
            .filter(s => s.total > 0)
            .map(s => (
              <div key={s.label} className="glass no-shadow p-6 rounded-[2rem] border-white/5">
                <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40 mb-2">{s.label}</p>
                <p className="text-2xl font-black" style={{ color: pctColor(s.total ? (s.score / s.total) * 100 : 0) }}>
                  {s.score}/{s.total}
                </p>
              </div>
            ))}
        </div>
      )}

      {/* Question breakdown */}
      <div className="space-y-3 pb-12">
        <p className="text-[9px] font-black text-secondary uppercase tracking-[0.4em] opacity-40 px-2">Question Breakdown</p>
        {(breakdown ?? []).map((q: any, i: number) => (
          <div key={i} className="glass no-shadow p-5 rounded-[1.5rem] border-white/5 space-y-3">
            <div className="flex items-start gap-4">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${q.is_correct ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {q.number}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-primary line-clamp-2">{q.statement}</p>
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-secondary opacity-40">{q.type}</span>
                  {q.topic_tag && <span className="text-[9px] font-black uppercase bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded">{q.topic_tag}</span>}
                  <span className="text-[9px] font-black text-secondary opacity-40">{q.time_spent_seconds ? `${Math.round(q.time_spent_seconds / 60)}m` : ''}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-black" style={{ color: pctColor(q.marks_total ? (q.marks_awarded / q.marks_total) * 100 : 0) }}>
                  {q.marks_awarded}/{q.marks_total}
                </p>
              </div>
            </div>
            {q.type === 'debugging' && q.submitted_code && (
              <div className="rounded-xl overflow-hidden border border-white/5 h-40">
                <Editor value={q.submitted_code} language={q.language ?? 'python'} theme={monacoTheme}
                  options={{ readOnly: true, minimap: { enabled: false }, fontSize: 11, lineNumbers: 'off', scrollBeyondLastLine: false }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Admin: StudentListView ────────────────────────────────────────────────────
function AdminStudentListView({ testId, testTitle, onBack, onSelectAttempt }: {
  testId: string; testTitle: string; onBack: () => void;
  onSelectAttempt: (attemptId: string, studentName: string) => void;
}) {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    // Use admin integrity endpoint which returns all students with attempt data
    api.get(`/admin/tests/${testId}/integrity`)
      .then(r => setStudents(r.data.attempts ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [testId]);

  const filtered = useMemo(() =>
    students.filter(s => s.student_name?.toLowerCase().includes(search.toLowerCase())),
    [students, search]
  );

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-6">
      <div className="relative w-full max-w-sm">
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search students..."
          className="w-full pl-11 pr-4 py-2.5 bg-black/10 border border-white/10 rounded-2xl text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-white/10 font-bold"
        />
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center glass no-shadow border-dashed border-white/10 rounded-[2.5rem]">
          <FiUsers className="mx-auto text-4xl text-white/10 mb-4" />
          <p className="text-[10px] font-black text-white/20 tracking-[0.4em] uppercase">No student submissions yet</p>
        </div>
      ) : (
        <AnimatedList items={filtered} className="flex flex-col gap-3" renderItem={(s) => (
          <div
            onClick={() => onSelectAttempt(s.attempt_id, s.student_name)}
            className="group glass no-shadow p-5 flex items-center gap-5 rounded-[1.5rem] border-white/5 hover:bg-white/[0.08] hover:border-indigo-500/30 cursor-pointer transition-all"
          >
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-xs font-black text-indigo-400 shrink-0">
              {s.student_name?.[0] ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-primary truncate uppercase tracking-tight">{s.student_name}</p>
              <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40 mt-0.5">
                {s.division} · {s.year}
              </p>
            </div>
            <div className="text-right shrink-0 mr-2">
              <p className="text-xl font-black tabular-nums" style={{ color: pctColor(s.percentage ?? 0) }}>
                {Math.round(s.percentage ?? 0)}%
              </p>
              <p className="text-[9px] font-black text-secondary opacity-30 uppercase">Score</p>
            </div>
            <FiChevronRight className="text-secondary opacity-20 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />
          </div>
        )} />
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ResultsApp({ testId: propTestId, testTitle: propTestTitle, attemptId: propAttemptId }: ResultsAppProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { openWindow } = useOSStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'master_admin';
  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'light';

  // ── STUDENT FLOW ─────────────────────────────────────────────
  // discovery (list) → detail
  // ── ADMIN FLOW ───────────────────────────────────────────────
  // tests (list) → students (list) → detail

  type View = 'discovery' | 'detail' | 'tests' | 'students';
  const [view, setView] = useState<View>(() => {
    if (propAttemptId && !isAdmin) return 'detail';
    if (isAdmin) return 'tests';
    return 'discovery';
  });

  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(propAttemptId || null);
  const [selectedStudentName, setSelectedStudentName] = useState<string | null>(null);
  const [selectedTest, setSelectedTest] = useState<{ id: string; title: string } | null>(
    propTestId ? { id: propTestId, title: propTestTitle ?? '' } : null
  );

  // Student discovery list
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [histSearch, setHistSearch] = useState('');

  // Admin tests list
  const [adminTests, setAdminTests] = useState<any[]>([]);
  const [testsLoading, setTestsLoading] = useState(false);
  const [testsSearch, setTestsSearch] = useState('');

  // Load student history
  useEffect(() => {
    if (!isAdmin && view === 'discovery') {
      setHistoryLoading(true);
      api.get('/attempts/my')
        .then(r => setHistory(r.data.attempts ?? []))
        .catch(console.error)
        .finally(() => setHistoryLoading(false));
    }
  }, [view, isAdmin]);

  // Load admin tests list
  useEffect(() => {
    if (isAdmin && view === 'tests') {
      setTestsLoading(true);
      api.get('/tests')
        .then(r => setAdminTests(r.data.tests ?? []))
        .catch(console.error)
        .finally(() => setTestsLoading(false));
    }
  }, [view, isAdmin]);

  const filteredHistory = useMemo(() =>
    history.filter(h => (h.test_title ?? '').toLowerCase().includes(histSearch.toLowerCase())),
    [history, histSearch]
  );

  const filteredTests = useMemo(() =>
    adminTests.filter(t => (t.title ?? '').toLowerCase().includes(testsSearch.toLowerCase())),
    [adminTests, testsSearch]
  );

  // Back navigation
  const handleBack = () => {
    if (view === 'detail' && !propAttemptId) {
      if (isAdmin && selectedTest) { setView('students'); return; }
      setView('discovery');
    } else if (view === 'students') {
      setView('tests');
    } else if (view === 'discovery') {
      // Student only: go back to tests hub
      openWindow('tests');
    }
    // Admin at 'tests' view: back button is a no-op (already at top level)
  };

  // Header title
  const headerTitle = () => {
    if (view === 'tests') return 'Evaluation Archive';
    if (view === 'students') return selectedTest?.title ?? 'Student Results';
    if (view === 'detail') return selectedStudentName ?? 'Result Breakdown';
    return 'Evaluation Archive';
  };

  const headerSub = () => {
    if (view === 'tests') return isAdmin ? 'Select a test to view student results' : 'Review your historical academic performance';
    if (view === 'students') return 'Select a student to view their full result';
    if (view === 'detail') return isAdmin ? selectedTest?.title ?? '' : 'Your full result breakdown';
    return 'Select a concluded trial to review';
  };

  return (
    <div className="h-full flex flex-col bg-transparent animate-in fade-in duration-500 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 p-6 border-b border-white/5 bg-black/5 shrink-0">
        <button onClick={handleBack} className="p-2.5 rounded-xl hover:bg-white/10 transition-colors border border-white/5 active:scale-95">
          <FiArrowLeft className="text-secondary" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-black text-primary tracking-tight flex items-center gap-3 uppercase">
            <FiBarChart2 className="text-indigo-500" />
            {headerTitle()}
          </h1>
          <p className="text-[10px] font-black uppercase text-secondary tracking-widest mt-0.5 opacity-40">{headerSub()}</p>
        </div>
        {/* Search bar for list views */}
        {(view === 'discovery' || view === 'tests') && (
          <div className="relative w-64">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
            <input
              type="text"
              placeholder={view === 'tests' ? 'Search tests...' : 'Search trials...'}
              value={view === 'tests' ? testsSearch : histSearch}
              onChange={e => view === 'tests' ? setTestsSearch(e.target.value) : setHistSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-black/10 border border-white/10 rounded-2xl text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-white/10 font-bold"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">

        {/* ADMIN: Tests list */}
        {isAdmin && view === 'tests' && (
          <div className="p-8 max-w-5xl mx-auto">
            {testsLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            ) : filteredTests.length === 0 ? (
              <div className="py-20 text-center glass no-shadow border-dashed border-white/10 rounded-[2.5rem]">
                <FiList className="mx-auto text-4xl text-white/10 mb-4" />
                <p className="text-[10px] font-black text-white/20 tracking-[0.4em] uppercase">No tests found</p>
              </div>
            ) : (
              <AnimatedList items={filteredTests} className="flex flex-col gap-3" renderItem={(t) => {
                const statusColor = t.status === 'ended' ? '#4ade80' : t.status === 'active' ? '#facc15' : 'rgba(255,255,255,0.2)';
                return (
                  <div
                    onClick={() => { setSelectedTest({ id: t.id, title: t.title }); setView('students'); }}
                    className="group glass no-shadow p-5 flex items-center gap-5 rounded-[1.5rem] border-white/5 hover:bg-white/[0.08] hover:border-indigo-500/30 cursor-pointer transition-all"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                      <FiFileText className="text-secondary group-hover:text-indigo-400 text-xl transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-black text-primary truncate uppercase tracking-tight">{t.title}</h3>
                        <span className="text-[8px] font-black px-2 py-0.5 rounded tracking-widest uppercase shrink-0"
                          style={{ background: `${statusColor}20`, color: statusColor }}>
                          {t.status}
                        </span>
                      </div>
                      <p className="text-[9px] text-secondary font-black uppercase tracking-widest opacity-40 mt-1">
                        {t.subject} · Year {t.year} · Div {t.division}
                      </p>
                    </div>
                    <FiChevronRight className="text-secondary opacity-20 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />
                  </div>
                );
              }} />
            )}
          </div>
        )}

        {/* ADMIN: Students list */}
        {isAdmin && view === 'students' && selectedTest && (
          <AdminStudentListView
            testId={selectedTest.id}
            testTitle={selectedTest.title}
            onBack={() => setView('tests')}
            onSelectAttempt={(aId, name) => {
              setSelectedAttemptId(aId);
              setSelectedStudentName(name);
              setView('detail');
            }}
          />
        )}

        {/* STUDENT: Discovery list */}
        {!isAdmin && view === 'discovery' && (
          <div className="p-8 max-w-5xl mx-auto">
            {historyLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="py-20 text-center glass no-shadow border-dashed border-white/10 rounded-[2.5rem]">
                <FiBarChart2 className="mx-auto text-4xl text-white/10 mb-4" />
                <p className="text-[10px] font-black text-white/20 tracking-[0.4em] uppercase">No concluded trials found</p>
              </div>
            ) : (
              <AnimatedList items={filteredHistory} className="flex flex-col gap-3" renderItem={(h) => {
                const isAbsent = h.status === 'absent';
                return (
                  <div
                    onClick={() => { if (!isAbsent && h.id) { setSelectedAttemptId(h.id); setView('detail'); } }}
                    className={`group glass no-shadow p-5 flex items-center gap-6 transition-all border-white/5 rounded-[1.5rem] ${
                      isAbsent ? 'cursor-not-allowed opacity-50' : 'hover:bg-white/[0.08] hover:border-indigo-500/30 cursor-pointer'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                      {isAbsent ? <FiSlash className="text-red-400 opacity-60" /> : <FiCheckCircle className="text-secondary group-hover:text-indigo-400 text-xl" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-black text-primary truncate uppercase tracking-tight">{h.test_title}</h3>
                        {isAbsent && <span className="text-[8px] font-black bg-red-500/20 text-red-400 px-2 py-0.5 rounded tracking-widest uppercase shrink-0">Absent</span>}
                      </div>
                      <p className="text-[9px] text-secondary font-black uppercase tracking-widest opacity-40 mt-1">
                        {isAbsent ? 'No record' : fmtDate(h.submitted_at)}
                      </p>
                    </div>
                    <div className="text-right mr-3 shrink-0">
                      <p className="text-xl font-black tabular-nums" style={{ color: isAbsent ? '#f87171' : pctColor(h.percentage ?? 0) }}>
                        {isAbsent ? '—' : `${Math.round(h.percentage ?? 0)}%`}
                      </p>
                      <p className="text-[9px] font-black text-secondary opacity-30 uppercase">
                        {isAbsent ? 'Absent' : `${h.total_score}/${h.total_marks}`}
                      </p>
                    </div>
                    {!isAbsent && <FiChevronRight className="text-secondary opacity-20 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />}
                  </div>
                );
              }} />
            )}
          </div>
        )}

        {/* BOTH: Result Detail */}
        {view === 'detail' && selectedAttemptId && (
          <ResultDetailView attemptId={selectedAttemptId} monacoTheme={monacoTheme} onBack={handleBack} />
        )}

      </div>
    </div>
  );
}
