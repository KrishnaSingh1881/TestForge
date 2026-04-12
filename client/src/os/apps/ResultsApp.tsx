
import { useEffect, useState, useRef, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../../lib/axios';
import { useTheme } from '../../context/ThemeContext';
import AnimatedList from '../../components/AnimatedList';
import { FiArrowLeft, FiSearch, FiChevronRight, FiUser, FiCalendar, FiClock, FiFileText } from 'react-icons/fi';
import { GlassIcon } from '../components/AppIcons';
import BorderGlow from '../../components/BorderGlow';

interface ResultsAppProps {
  testId?: string;
  testTitle?: string;
  attemptId?: string;
}

function gradeBand(pct: number) {
  if (pct >= 90) return { grade: 'A+', color: '#4ade80' };
  if (pct >= 80) return { grade: 'A', color: '#4ade80' };
  if (pct >= 70) return { grade: 'B', color: '#86efac' };
  if (pct >= 60) return { grade: 'C', color: '#facc15' };
  if (pct >= 40) return { grade: 'D', color: '#fb923c' };
  return { grade: 'F', color: '#f87171' };
}

function marksColor(awarded: number, total: number) {
  if (total === 0) return 'rgb(var(--text-secondary))';
  const r = awarded / total;
  if (r >= 1) return '#4ade80';
  if (r >= 0.5) return '#facc15';
  return '#f87171';
}

function ScoreCircle({ score, total, pct }: { score: number; total: number; pct: number }) {
  const { grade, color } = gradeBand(pct);
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="relative w-40 h-40 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--glass-border)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold tabular-nums" style={{ color: 'rgb(var(--text-primary))' }}>
          {score}
        </span>
        <span className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
          / {total}
        </span>
        <span className="text-lg font-bold mt-0.5" style={{ color }}>
          {grade}
        </span>
      </div>
    </div>
  );
}

function QuestionRow({ q, idx, monacoTheme }: { q: any; idx: number; monacoTheme: string }) {
  const [open, setOpen] = useState(false);
  const isMCQ = q.type === 'mcq_single' || q.type === 'mcq_multi';
  const isDebug = q.type === 'debugging';
  const mc = marksColor(q.marks_awarded, q.marks_total);

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--glass-border)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left transition-all hover:bg-black/10 group"
      >
        <span className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-[10px] font-black shrink-0 border border-indigo-500/20 group-hover:scale-110 transition-transform">
          {idx + 1}
        </span>

        <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 bg-black/5 text-secondary opacity-60 rounded-full shrink-0 border border-white/5">
          {isMCQ ? (q.type === 'mcq_multi' ? 'MCQ Multi' : 'MCQ') : 'Debug'}
        </span>

        <span className="flex-1 text-sm font-bold text-primary truncate uppercase tracking-tight opacity-80 group-hover:opacity-100 transition-opacity">
          {q.statement}
        </span>

        {isMCQ && (
          <span className="text-[10px] font-black px-3 py-1 rounded-full shrink-0 border"
            style={{ backgroundColor: `${mc}15`, color: mc, borderColor: `${mc}30` }}>
            {q.marks_awarded}/{q.marks_total}
          </span>
        )}

        {isDebug && (
          <span className="text-[10px] font-black px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 shrink-0">
            {q.visible_cases_passed}/{q.visible_cases_total} VISIBLE
          </span>
        )}

        <FiChevronRight className={`text-secondary text-base transition-transform duration-300 ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t space-y-3" style={{ borderColor: 'var(--glass-border)' }}>
          {isMCQ && (
            <div className="space-y-2">
              {(q.options ?? []).map((opt: any) => {
                const selected = opt.was_selected;
                const correct = opt.is_correct;
                let bg = 'rgba(255,255,255,0.04)';
                let border = 'var(--glass-border)';
                let icon = '';
                if (correct && selected) {
                  bg = 'rgba(74,222,128,0.1)';
                  border = 'rgba(74,222,128,0.4)';
                  icon = '✓';
                } else if (correct) {
                  bg = 'rgba(74,222,128,0.06)';
                  border = 'rgba(74,222,128,0.25)';
                  icon = '✓';
                } else if (selected) {
                  bg = 'rgba(239,68,68,0.1)';
                  border = 'rgba(239,68,68,0.4)';
                  icon = '✗';
                }

                return (
                  <div
                    key={opt.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: bg, border: `1px solid ${border}` }}
                  >
                    {icon && (
                      <span
                        className="font-bold text-xs shrink-0"
                        style={{ color: correct ? '#4ade80' : '#f87171' }}
                      >
                        {icon}
                      </span>
                    )}
                    <span style={{ color: 'rgb(var(--text-primary))' }}>{opt.option_text}</span>
                  </div>
                );
              })}
            </div>
          )}

          {isDebug && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="rounded-lg p-3 text-center"
                  style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}
                >
                  <p
                    className="text-lg font-bold"
                    style={{
                      color: q.visible_cases_passed === q.visible_cases_total ? '#4ade80' : '#facc15',
                    }}
                  >
                    {q.visible_cases_passed}/{q.visible_cases_total}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-secondary))' }}>
                    Visible cases
                  </p>
                </div>
                <div
                  className="rounded-lg p-3 text-center"
                  style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}
                >
                   <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-secondary))' }}>
                    Automated Verification
                  </p>
                </div>
              </div>

              {q.submitted_code && (
                <div>
                  <p className="text-xs mb-1.5 font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>
                    Submitted Code
                  </p>
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--glass-border)' }}>
                    <Editor
                      height="200px"
                      language={q.language === 'cpp' ? 'cpp' : 'python'}
                      theme={monacoTheme}
                      value={q.submitted_code}
                      options={{
                        readOnly: true,
                        fontSize: 12,
                        minimap: { enabled: false },
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        padding: { top: 8 },
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ResultsApp({ testId, testTitle, attemptId }: ResultsAppProps) {
  const { theme } = useTheme();
  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'light';

  const [view, setView] = useState<'tests' | 'students' | 'details'>('tests');
  const [selectedTest, setSelectedTest] = useState<{ id: string; title: string } | null>(null);
  const [selectedAttempt, setSelectedAttempt] = useState<string | null>(null);

  const [tests, setTests] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [detailData, setDetailData] = useState<any>(null);
  
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Initial routing
  useEffect(() => {
    if (attemptId) {
      setSelectedAttempt(attemptId);
      setView('details');
    } else if (testId) {
      setSelectedTest({ id: testId, title: testTitle || 'Selected Test' });
      setView('students');
    } else {
      loadTests();
    }
  }, [testId, testTitle, attemptId]);

  async function loadTests() {
    setLoading(true);
    try {
      const r = await api.get('/tests');
      setTests(r.data.tests ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function loadAttempts(tId: string) {
    setLoading(true);
    try {
      const r = await api.get(`/admin/tests/${tId}/integrity`);
      setAttempts(r.data.attempts ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(aId: string) {
    setLoading(true);
    try {
      const r = await api.get(`/attempts/${aId}/result`);
      setDetailData(r.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (view === 'students' && selectedTest) {
      loadAttempts(selectedTest.id);
    }
  }, [view, selectedTest]);

  useEffect(() => {
    if (view === 'details' && selectedAttempt) {
      loadDetail(selectedAttempt);
    }
  }, [view, selectedAttempt]);

  const filteredTests = useMemo(() => {
    return tests.filter(t => 
      (t.title ?? '').toLowerCase().includes(search.toLowerCase()) || 
      (t.subject ?? '').toLowerCase().includes(search.toLowerCase())
    );
  }, [tests, search]);

  const filteredAttempts = useMemo(() => {
    return attempts.filter(a => 
      (a.student_name ?? '').toLowerCase().includes(search.toLowerCase()) || 
      (a.student_email ?? '').toLowerCase().includes(search.toLowerCase())
    );
  }, [attempts, search]);

  const handleBack = () => {
    if (view === 'details') {
      if (attemptId) {
          if (testId) setView('students');
      } else {
          setView('students');
      }
    } else if (view === 'students') {
      setView('tests');
      setSearch('');
    }
  };

  return (
    <div className="h-full flex flex-col bg-transparent">
      {/* App Header */}
      <div className="flex items-center gap-4 p-6 border-b border-white/5">
        {(view !== 'tests' || (view === 'tests' && testId)) && (
          <button onClick={handleBack} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <FiArrowLeft className="text-secondary" />
          </button>
        )}
        <div className="flex-1">
          <h1 className="text-xl font-bold text-primary">
            {view === 'tests' && "Results Explorer"}
            {view === 'students' && (selectedTest?.title || "Student Results")}
            {view === 'details' && detailData?.attempt?.student_name}
          </h1>
          <p className="text-xs text-secondary">
            {view === 'tests' && "Select a test to view performance analytics"}
            {view === 'students' && "Select a student to view detailed results"}
            {view === 'details' && detailData?.attempt?.test_title}
          </p>
        </div>
        {view !== 'details' && (
            <div className="relative w-64">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input 
                    type="text" 
                    placeholder="Search..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-black/5 border border-white/10 rounded-xl text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                />
            </div>
        )}
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-sm font-medium text-white/50 tracking-widest uppercase">Loading</p>
            </div>
          </div>
        ) : (
          <div className="p-6">
            {view === 'tests' && (
              <AnimatedList 
                items={filteredTests}
                containerClassName="w-full"
                className="flex flex-col gap-4"
                renderItem={(t) => (
                  <div className="group relative glass no-shadow p-5 flex items-center gap-5 transition-all hover:bg-white/[0.08] hover:border-white/20">
                    <div className="p-3 bg-indigo-500/20 rounded-2xl group-hover:scale-110 transition-transform duration-500">
                        <GlassIcon id="prism" size="sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-primary font-bold text-base truncate">{t.title}</h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-secondary">
                            <span className="flex items-center gap-1"><FiCalendar className="text-indigo-400" /> {t.year}</span>
                            <span className="w-1 h-1 rounded-full bg-white/20" />
                            <span className="flex items-center gap-1"><FiFileText className="text-indigo-400" /> {t.subject}</span>
                        </div>
                    </div>
                    <FiChevronRight className="text-white/20 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </div>
                )}
                onItemSelect={(t) => {
                  setSelectedTest(t);
                  setView('students');
                  setSearch('');
                }}
              />
            )}

            {view === 'students' && (
              <AnimatedList 
                items={filteredAttempts}
                containerClassName="w-full"
                className="flex flex-col gap-3"
                renderItem={(a) => {
                  const sc = a.percentage;
                  const color = gradeBand(sc ?? 0).color;
                  return (
                    <div className="group relative glass no-shadow p-4 flex items-center gap-4 transition-all hover:bg-white/[0.08] hover:border-white/20">
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                            <FiUser className="text-secondary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-primary font-bold text-sm truncate">{a.student_name}</h3>
                            <p className="text-[10px] text-secondary mt-0.5 uppercase tracking-wider">{a.division} • {a.year}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-black tabular-nums" style={{ color }}>{a.total_score}/{a.total_marks}</p>
                            <p className="text-[10px] text-secondary font-bold">{Math.round(sc ?? 0)}%</p>
                        </div>
                        <FiChevronRight className="text-secondary group-hover:text-primary transition-all" />
                    </div>
                  );
                }}
                onItemSelect={(a) => {
                  setSelectedAttempt(a.attempt_id);
                  setView('details');
                }}
              />
            )}

            {view === 'details' && detailData && (
              <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
                {/* Score Hero */}
                <BorderGlow 
                    glowColor={gradeBand(detailData.result?.percentage ?? 0).color || '#6366f1'}
                    backgroundColor="transparent"
                    borderRadius={24}
                    glowIntensity={0.6}
                    className="no-shadow"
                >
                    <div className="p-8 flex flex-col md:flex-row items-center gap-8">
                        <div className="shrink-0 text-center">
                            <ScoreCircle 
                                score={detailData.result?.total_score ?? 0} 
                                total={detailData.result?.total_marks ?? 0} 
                                pct={Math.round(detailData.result?.percentage ?? 0)} 
                            />
                            <p className="text-3xl font-black mt-4 tracking-tighter" style={{ color: gradeBand(detailData.result?.percentage ?? 0).color }}>
                                {Math.round(detailData.result?.percentage ?? 0)}%
                            </p>
                        </div>

                        <div className="flex-1 w-full space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl bg-black/5 border border-white/5">
                                    <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-1">Rank</p>
                                    <p className="text-2xl font-black text-indigo-400">#{detailData.result?.rank || '--'}</p>
                                </div>
                                <div className="p-4 rounded-2xl bg-black/5 border border-white/5">
                                    <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-1">Status</p>
                                    <p className="text-2xl font-black" style={{ color: detailData.result?.pass_fail_overall ? '#4ade80' : '#f87171' }}>
                                        {detailData.result?.pass_fail_overall ? 'PASSED' : 'FAILED'}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="text-center p-3 rounded-xl bg-black/5">
                                    <p className="text-[9px] font-bold text-secondary uppercase mb-1">MCQ</p>
                                    <p className="text-sm font-black text-primary">{detailData.section_scores?.mcqScore ?? 0}/{detailData.section_scores?.mcqTotal ?? 0}</p>
                                </div>
                                <div className="text-center p-3 rounded-xl bg-black/5">
                                    <p className="text-[9px] font-bold text-secondary uppercase mb-1">Coding</p>
                                    <p className="text-sm font-black text-primary">{detailData.section_scores?.debugScore ?? 0}/{detailData.section_scores?.debugTotal ?? 0}</p>
                                </div>
                                <div className="text-center p-3 rounded-xl bg-black/5">
                                    <p className="text-[9px] font-bold text-secondary uppercase mb-1">Time</p>
                                    <p className="text-sm font-black text-primary">{detailData.attempt?.time_taken_mins || '--'}m</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </BorderGlow>

                {/* Breakdown */}
                <div className="space-y-4">
                    <h2 className="text-xs font-black text-secondary opacity-60 uppercase tracking-[0.3em] ml-2">Question Breakdown</h2>
                    <div className="grid gap-3">
                        {detailData.breakdown.map((q: any, i: number) => (
                            <QuestionRow key={q.question_id} q={q} idx={i} monacoTheme={monacoTheme} />
                        ))}
                    </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
