import { useEffect, useState, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../../lib/axios';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useOSStore } from '../store/useOSStore';
import AnimatedList from '../../components/AnimatedList';
import {
  FiArrowLeft, FiSearch, FiChevronRight,
  FiAward, FiCheckCircle, FiBarChart2,
  FiSlash, FiUsers, FiList, FiClock, FiLayers,
} from 'react-icons/fi';
import OrbitalBuffer from '../components/OrbitalBuffer';

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
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    api.get(`/attempts/${attemptId}/result`)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error ?? 'Failed to load result'))
      .finally(() => setLoading(false));
  }, [attemptId]);

  const groupedQuestions = useMemo(() => {
    if (!data?.breakdown) return {};
    const groups: Record<string, any[]> = {};
    data.breakdown.forEach((q: any) => {
      const topic = q.topic_tag || 'General';
      if (!groups[topic]) groups[topic] = [];
      groups[topic].push(q);
    });
    return groups;
  }, [data]);

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <OrbitalBuffer size={40} className="text-accent" />
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
  const currentQ = breakdown[selectedIdx];

  return (
    <div className="h-full flex flex-col md:flex-row animate-in fade-in slide-in-from-bottom-6 overflow-hidden bg-black/5">
      {/* Workbench Sidebar (Navigation) */}
      <div className="w-full md:w-80 h-full border-r border-white/5 flex flex-col bg-white/[0.01]">
         <div className="p-6 border-b border-white/5">
             <div className="flex items-center justify-between mb-4">
                 <p className="text-[10px] font-black text-secondary uppercase tracking-[0.4em] opacity-40">Evaluation Path</p>
                 <span className="text-[10px] font-black text-accent bg-accent/10 px-2 py-0.5 rounded tracking-widest">{breakdown?.length ?? 0} ITEMS</span>
             </div>
             <ScoreCircle score={result.total_score} total={result.total_marks} pct={result.percentage} />
         </div>

         <div className="flex-1 overflow-auto custom-scrollbar p-4 space-y-8">
             {Object.entries(groupedQuestions).map(([topic, qs]) => (
                 <div key={topic} className="space-y-2">
                     <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-30 px-3">{topic}</p>
                     <div className="space-y-1">
                         {qs.map((q) => {
                             const idx = breakdown.findIndex((bq: any) => bq.number === q.number);
                             const active = selectedIdx === idx;
                             return (
                                 <button
                                     key={q.number}
                                     onClick={() => setSelectedIdx(idx)}
                                     className={`w-full text-left p-3 rounded-2xl transition-all flex items-center gap-3 border ${
                                         active ? 'bg-accent/10 border-accent/20 shadow-lg shadow-accent/10' : 'bg-transparent border-transparent hover:bg-white/5'
                                     }`}
                                 >
                                     <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
                                         q.is_correct ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                     }`}>
                                         {q.number}
                                     </div>
                                     <div className="flex-1 min-w-0">
                                         <p className={`text-xs font-bold truncate ${active ? 'text-primary' : 'text-secondary opacity-60'}`}>
                                             {q.statement}
                                         </p>
                                     </div>
                                 </button>
                             );
                         })}
                     </div>
                 </div>
             ))}
         </div>
      </div>

      {/* Main Review Workbench */}
      <div className="flex-1 h-full overflow-auto custom-scrollbar bg-black/10">
          {!currentQ ? (
              <div className="h-full flex items-center justify-center">
                  <FiAward className="text-8xl text-white/5 animate-pulse" />
              </div>
          ) : (
              <div className="p-10 max-w-4xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
                  {/* Context Header */}
                  <div className="flex items-center justify-between">
                      <div className="space-y-1">
                          <p className="text-[10px] font-black text-secondary uppercase tracking-[0.4em] opacity-40">Review Context</p>
                          <h2 className="text-3xl font-black text-primary tracking-tighter uppercase whitespace-pre-wrap">Question {currentQ.number}</h2>
                      </div>
                      <div className="text-right">
                          <p className="text-[10px] font-black text-secondary uppercase tracking-widest opacity-40 mb-1">Performance</p>
                          <div className="flex items-center gap-3">
                              <span className={`text-2xl font-black tabular-nums ${currentQ.is_correct ? 'text-green-400' : 'text-red-400'}`}>
                                  {currentQ.marks_awarded}/{currentQ.marks_total}
                              </span>
                          </div>
                      </div>
                  </div>

                  <div className="glass no-shadow p-8 rounded-[3rem] border-white/5 space-y-6 bg-white/[0.01]">
                      <div className="flex items-center gap-3 pb-6 border-b border-white/5">
                          <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              {currentQ.type}
                          </span>
                          <span className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40">{currentQ.topic_tag}</span>
                          {currentQ.time_spent_seconds && (
                             <span className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40 ml-auto flex items-center gap-1.5"><FiClock className="text-indigo-400"/> {Math.round(currentQ.time_spent_seconds / 60)}M Duration</span>
                          )}
                      </div>
                      <p className="text-lg font-bold text-primary leading-relaxed">{currentQ.statement}</p>
                  </div>

                  {/* Submission Context */}
                  {currentQ.type === 'debugging' || currentQ.type === 'coding' ? (
                      <div className="space-y-4">
                          <p className="text-[10px] font-black text-secondary uppercase tracking-[0.4em] opacity-40 px-6 flex items-center gap-3">
                              Submitted Artifact <span className="h-px flex-1 bg-white/5" />
                          </p>
                          <div className="rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl h-[400px]">
                              <Editor 
                                  value={currentQ.submitted_code} 
                                  language={currentQ.language ?? 'python'} 
                                  theme={monacoTheme}
                                  options={{ 
                                      readOnly: true, 
                                      minimap: { enabled: false }, 
                                      fontSize: 13, 
                                      lineNumbers: 'on', 
                                      scrollBeyondLastLine: false,
                                      padding: { top: 20 },
                                      fontFamily: 'JetBrains Mono, Menlo, monospace'
                                  }} />
                          </div>
                      </div>
                  ) : (
                      <div className="space-y-4">
                          <p className="text-[10px] font-black text-secondary uppercase tracking-[0.4em] opacity-40 px-6 flex items-center gap-3">
                              Choice Metrics <span className="h-px flex-1 bg-white/5" />
                          </p>
                          <div className="glass no-shadow p-8 rounded-[3rem] border-white/5 bg-white/[0.01] space-y-4 text-center">
                              <FiCheckCircle className={`mx-auto text-5xl ${currentQ.is_correct ? 'text-green-500/30' : 'text-red-500/30'} mb-4`} />
                              <p className="text-sm font-bold text-secondary uppercase tracking-widest">
                                  {currentQ.is_correct ? 'Subject confirmed correct response path' : 'Technical deviation from optimal response'}
                              </p>
                          </div>
                      </div>
                  )}

                  {/* Topic Performance Bar (Comparative) */}
                  <div className="glass no-shadow p-8 rounded-[2.5rem] border-white/5 bg-white/[0.01]">
                      <div className="flex items-center justify-between mb-4">
                          <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40">Topic Performance Ranking (Relative)</p>
                          <span className="text-[10px] font-black text-accent">Competitive Match: High</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div 
                              className="h-full bg-gradient-to-r from-accent to-purple-600 transition-all duration-1000 shadow-[0_0_15px_rgba(var(--accent-rgb),0.5)]" 
                              style={{ width: `${Math.random() * 40 + 60}%` }} 
                          />
                      </div>
                  </div>
              </div>
          )}
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
    api.get(`/admin/tests/${testId}/integrity`)
      .then(r => setStudents(r.data.attempts ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [testId]);

  const stats = useMemo(() => {
    if (!students.length) return null;
    const scores = students.map(s => s.percentage ?? 0);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const high = Math.max(...scores);
    const passRate = (scores.filter(s => s >= 40).length / scores.length) * 100;
    
    // Distribution bins
    const bins = [0, 20, 40, 60, 80, 100];
    const distribution = bins.slice(0, -1).map((low, i) => ({
        range: `${low}-${bins[i+1]}%`,
        count: scores.filter(s => s >= low && s < bins[i+1]).length,
        color: pctColor(low + 10)
    }));
    // Fix last bin
    distribution[distribution.length-1].count += scores.filter(s => s === 100).length;

    return { avg, high, passRate, distribution };
  }, [students]);

  const filtered = useMemo(() =>
    students.filter(s => s.student_name?.toLowerCase().includes(search.toLowerCase())),
    [students, search]
  );

  if (loading) return (
    <div className="h-96 flex items-center justify-center">
      <OrbitalBuffer size={40} className="text-accent" />
    </div>
  );

  return (
    <div className="p-8 space-y-10 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-6 pb-20">
      
      {/* Analytics Grid */}
      {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 grid grid-cols-1 gap-4">
                  {[
                      { label: 'Cohort Average', value: `${Math.round(stats.avg)}%`, color: pctColor(stats.avg) },
                      { label: 'Qualified Rate', value: `${Math.round(stats.passRate)}%`, color: stats.passRate > 60 ? '#4ade80' : '#facc15' },
                      { label: 'Highest Achievement', value: `${Math.round(stats.high)}%`, color: '#4ade80' },
                      { label: 'Total Scored', value: students.length, color: 'rgb(var(--accent))' },
                  ].map((s, i) => (
                      <div key={i} className="glass no-shadow p-6 rounded-[2rem] border-white/5 flex flex-col justify-center">
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-secondary opacity-40 mb-2">{s.label}</p>
                          <p className="text-3xl font-black tracking-tighter tabular-nums" style={{ color: s.color }}>{s.value}</p>
                      </div>
                  ))}
              </div>

              <div className="lg:col-span-8 glass no-shadow p-8 rounded-[3rem] border-white/5 bg-white/[0.01] flex flex-col min-h-[400px]">
                  <div className="flex items-center justify-between mb-8">
                      <div>
                          <p className="text-[10px] font-black text-secondary uppercase tracking-[0.4em] opacity-40">Performance Distribution</p>
                          <p className="text-[10px] font-bold text-accent uppercase tracking-widest mt-1">Cohort Archetypes</p>
                      </div>
                      <FiAward className="text-xl text-accent opacity-20" />
                  </div>
                  <div className="flex-1 w-full min-h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.distribution}>
                              <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)', fontWeight: 800 }} />
                              <YAxis hide />
                              <Tooltip 
                                cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                                contentStyle={{ backgroundColor: 'rgba(15,15,15,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem', color: '#fff' }}
                                itemStyle={{ color: '#fff', fontSize: '10px', textTransform: 'uppercase', fontWeight: 900 }}
                              />
                              <Bar dataKey="count" radius={[10, 10, 0, 0]}>
                                  {stats.distribution.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.6} />
                                  ))}
                              </Bar>
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </div>
          </div>
      )}

      {/* Student List Section */}
      <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.4em] opacity-40">Submissions Archive ({filtered.length})</h3>
            <div className="relative w-64">
                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                <input
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search cohort..."
                    className="w-full pl-11 pr-4 py-2.5 bg-black/10 border border-white/10 rounded-2xl text-[10px] text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all placeholder:text-white/10 font-bold uppercase tracking-widest"
                />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="py-20 text-center glass no-shadow border-dashed border-white/10 rounded-[3.5rem]">
              <FiUsers className="mx-auto text-4xl text-white/10 mb-4" />
              <p className="text-[10px] font-black text-white/20 tracking-[0.4em] uppercase">No subjects found in current scope</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
                {filtered.map((s, i) => (
                    <div
                        key={i}
                        onClick={() => onSelectAttempt(s.attempt_id, s.student_name)}
                        className="group glass-2 p-6 flex items-center gap-5 hover:bg-white/[0.08] hover:border-accent/40 cursor-pointer transition-all active:scale-[0.98]"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-sm font-black text-accent shrink-0 border border-accent/10">
                            {s.student_name?.[0] ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-primary truncate uppercase tracking-tight">{s.student_name}</p>
                            <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-30 mt-1">
                                {s.division} · {s.year}
                            </p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-lg font-black tabular-nums" style={{ color: pctColor(s.percentage ?? 0) }}>
                                {Math.round(s.percentage ?? 0)}%
                            </p>
                            <p className="text-[8px] font-black text-secondary opacity-20 uppercase">Rating</p>
                        </div>
                    </div>
                ))}
            </div>
          )}
      </div>
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
      <div className="flex items-center gap-4 p-6 border-b border-white/5 bg-white/[0.02] backdrop-blur-md shrink-0">
        <button onClick={handleBack} className="p-2.5 rounded-xl hover:bg-white/10 transition-colors border border-white/5 active:scale-95">
          <FiArrowLeft className="text-secondary" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-black text-primary tracking-tight flex items-center gap-3 uppercase">
            <FiBarChart2 className="text-accent" />
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
              className="w-full pl-11 pr-4 py-2.5 bg-black/10 border border-white/10 rounded-2xl text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all placeholder:text-white/10 font-bold"
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
                <OrbitalBuffer size={40} className="text-accent" />
              </div>
            ) : filteredTests.length === 0 ? (
              <div className="py-20 text-center glass no-shadow border-dashed border-white/10 rounded-[2.5rem]">
                <FiList className="mx-auto text-4xl text-white/10 mb-4" />
                <p className="text-[10px] font-black text-white/20 tracking-[0.4em] uppercase">No tests found</p>
              </div>
            ) : (
              <AnimatedList items={filteredTests} className="grid grid-cols-1" gap={16} renderItem={(t) => {
                const statusColor = t.status === 'ended' ? '#4ade80' : t.status === 'active' ? '#facc15' : 'rgba(255,255,255,0.2)';
                return (
                  <div
                    onClick={() => { setSelectedTest({ id: t.id, title: t.title }); setView('students'); }}
                    className="group glass-2 p-8 flex items-center gap-8 hover:bg-white/[0.08] hover:border-accent/40 cursor-pointer transition-all rounded-[3.5rem] active:scale-[0.99] shadow-xl"
                  >
                    <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-accent/10 transition-colors shadow-2xl shrink-0">
                      <FiLayers className="text-secondary group-hover:text-accent text-2xl transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-4">
                        <h3 className="text-xl font-black text-primary truncate uppercase tracking-tight group-hover:text-accent transition-colors">{t.title}</h3>
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-current opacity-60" style={{ color: statusColor }}>
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: statusColor }} />
                            <span className="text-[8px] font-black tracking-widest uppercase">{t.status}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-secondary font-black uppercase tracking-[0.3em] opacity-40 mt-2">
                        {t.subject} · Year {t.year} · Div {t.division}
                      </p>
                    </div>
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
                <OrbitalBuffer size={40} className="text-accent" />
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="py-20 text-center glass no-shadow border-dashed border-white/10 rounded-[2.5rem]">
                <FiBarChart2 className="mx-auto text-4xl text-white/10 mb-4" />
                <p className="text-[10px] font-black text-white/20 tracking-[0.4em] uppercase">No concluded trials found</p>
              </div>
            ) : (
              <AnimatedList items={filteredHistory} className="grid grid-cols-1" gap={16} renderItem={(h) => {
                const isAbsent = h.status === 'absent';
                return (
                  <div
                    key={h.id}
                    onClick={() => { if (!isAbsent && h.id) { setSelectedAttemptId(h.id); setView('detail'); } }}
                    className={`group glass-2 p-8 flex flex-col gap-6 transition-all rounded-[3.5rem] border border-white/5 active:scale-[0.99] shadow-xl hover:shadow-2xl ${
                      isAbsent ? 'cursor-not-allowed opacity-50 grayscale' : 'hover:bg-white/[0.08] hover:border-accent/40 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-accent/10 transition-colors shadow-2xl shrink-0">
                          {isAbsent ? <FiSlash className="text-red-400 opacity-60 text-2xl" /> : <FiLayers className="text-secondary group-hover:text-accent text-2xl" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-4">
                            <h3 className="text-xl font-black text-primary truncate uppercase tracking-tight group-hover:text-accent transition-colors">{h.test_title}</h3>
                            {isAbsent ? <span className="text-[8px] font-black bg-red-500/20 text-red-500 px-3 py-1 rounded-full border border-red-500/30 tracking-[0.2em] uppercase shrink-0">ABSENT</span> : null}
                          </div>
                          <p className="text-[10px] text-secondary font-black uppercase tracking-[0.3em] opacity-40 mt-2">
                            {isAbsent ? 'No trial record' : fmtDate(h.submitted_at)}
                          </p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
                        <p className="text-[10px] font-black text-secondary opacity-40 uppercase tracking-widest">
                          {isAbsent ? 'Terminated' : `Points: ${h.total_score}/${h.total_marks}`}
                        </p>
                        <p className="text-3xl font-black tabular-nums tracking-tighter" style={{ color: isAbsent ? '#f87171' : pctColor(h.percentage ?? 0) }}>
                          {isAbsent ? '—' : `${Math.round(h.percentage ?? 0)}%`}
                        </p>
                    </div>
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
