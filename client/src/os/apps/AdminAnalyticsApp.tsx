import { useEffect, useMemo, useState, Fragment } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import api from '../../lib/axios';
import { useOSStore } from '../store/useOSStore';
import BorderGlow from '../../components/BorderGlow';
import AnimatedList from '../../components/AnimatedList';
import { FiArrowLeft, FiSearch, FiChevronRight, FiBarChart2, FiCalendar, FiActivity, FiLayers } from 'react-icons/fi';
import { GlassIcon } from '../components/AppIcons';
import GlassSelect from '../../components/admin/GlassSelect';
import OrbitalBuffer from '../components/OrbitalBuffer';

interface TestRow {
  id: string; title: string; subject: string; year: string; division: string;
  total_attempts: number; submitted_count: number; avg_score: number;
  avg_percentage: number; completion_rate: number; avg_time_mins: number;
  hardest_question: { statement_preview: string; correct_rate: number } | null;
}
interface DivComp { test_id: string; test_title: string; division: string; avg_percentage: number; }
interface StudentRow {
  user_id: string; name: string; year: string; division: string;
  tests_attempted: number; avg_percentage: number; best_score: number;
}

function pctColor(p: number) {
  if (p >= 70) return '#4ade80';
  if (p >= 50) return '#facc15';
  return '#f87171';
}

const DIV_COLORS = ['#f08080', '#4ade80', '#facc15', '#fb923c', '#94a3b8'];

const axisStyle = { fontSize: 11, fill: 'rgb(148 163 184)' };

const inputCls = 'px-3 py-1.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent transition-all';
const inputStyle = {
  backgroundColor: 'rgba(255,255,255,0.07)',
  border: '1px solid var(--glass-border)',
  color: 'rgb(var(--text-primary))',
};

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="glass-2 p-5 text-center bg-white/[0.01]">
      <p className="text-2xl font-black tracking-tighter" style={{ color: color ?? 'rgb(var(--accent))' }}>{value}</p>
      <p className="text-[10px] font-black uppercase text-secondary tracking-widest mt-1 opacity-40">{label}</p>
    </div>
  );
}

function DivTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-2 px-3 py-2 text-xs space-y-1 bg-black/40 border-white/10 backdrop-blur-xl">
      <p className="font-semibold text-primary">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill }} className="font-bold">{p.name}: {p.value}%</p>
      ))}
    </div>
  );
}

export default function AdminAnalyticsApp() {
  const { openWindow } = useOSStore();

  const [view, setView] = useState<'tests' | 'dashboard'>('tests');

  // Filter state
  const [filters, setFilters] = useState({ year: '', division: '', subject: '', test_id: '', date_from: '', date_to: '' });
  const [applied, setApplied] = useState({ year: '', division: '', subject: '', test_id: '', date_from: '', date_to: '' });

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [search, setSearch] = useState('');

  // Table state
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSort, setStudentSort] = useState<'avg' | 'attempts'>('avg');

  async function load(f = applied) {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v) params.set(k, v); });
    try {
      const r = await api.get(`/analytics/admin?${params}`);
      setData(r.data);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function applyFilters() {
    setApplied({ ...filters });
    load(filters);
  }

  // Division comparison data — pivot for grouped bar chart
  const divCompData = useMemo(() => {
    if (!data?.division_comparison) return [];
    const filtered = applied.test_id
      ? data.division_comparison.filter((d: DivComp) => d.test_id === applied.test_id)
      : data.division_comparison;

    // Group by test_title, pivot divisions as keys
    const map: Record<string, any> = {};
    filtered.forEach((d: DivComp) => {
      if (!map[d.test_title]) map[d.test_title] = { test: d.test_title };
      map[d.test_title][d.division] = d.avg_percentage;
    });
    return Object.values(map);
  }, [data, applied.test_id]);

  const allDivisions = useMemo(() => {
    if (!data?.division_comparison) return [];
    return [...new Set(data.division_comparison.map((d: DivComp) => d.division))];
  }, [data]);

  // Filtered + sorted students
  const students: StudentRow[] = useMemo(() => {
    if (!data?.student_performance) return [];
    let list = [...data.student_performance];
    if (studentSearch.trim()) {
      const q = studentSearch.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q));
    }
    list.sort((a, b) => studentSort === 'avg'
      ? b.avg_percentage - a.avg_percentage
      : b.tests_attempted - a.tests_attempted
    );
    return list;
  }, [data, studentSearch, studentSort]);

  // Unique subjects from tests
  const subjects = useMemo(() => {
    if (!data?.tests) return [];
    return [...new Set(data.tests.map((t: TestRow) => t.subject).filter(Boolean))];
  }, [data]);

  const testOptions = useMemo(() => data?.tests ?? [], [data]);
  const filteredTestsList = useMemo(() => {
    if (!data?.tests) return [];
    return data.tests.filter((t: any) => 
        (t.title ?? '').toLowerCase().includes(search.toLowerCase()) || 
        (t.subject ?? '').toLowerCase().includes(search.toLowerCase())
    );
  }, [data, search]);

  const handleSelectTest = (t: any) => {
    setFilters(f => ({ ...f, test_id: t.id }));
    setApplied(f => ({ ...f, test_id: t.id }));
    setView('dashboard');
  };

  return (
    <div className="h-full flex flex-col bg-transparent animate-in fade-in duration-500 overflow-hidden">
      {/* App Header */}
      <div className="flex items-center gap-4 p-6 border-b border-white/5 bg-white/[0.02] backdrop-blur-md shrink-0">
        {view === 'dashboard' && (
          <button onClick={() => setView('tests')} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <FiArrowLeft className="text-secondary" />
          </button>
        )}
        <div className="flex-1">
          <h1 className="text-xl font-bold text-primary tracking-tight flex items-center gap-2 uppercase tracking-wide">
            <FiBarChart2 className="text-accent" />
            Performance Intel
          </h1>
          <p className="text-[10px] font-black uppercase text-secondary tracking-widest mt-0.5 opacity-60">
            {view === 'tests' ? "Select an evaluation for deep-dive diagnostics" : "Cross-Examination Behavioral Telemetry"}
          </p>
        </div>
        
        {view === 'tests' && (
          <div className="relative w-64">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary opacity-40" />
              <input 
                  type="text" 
                  placeholder="Search evaluations..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-black/5 border border-white/10 rounded-xl text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all placeholder:opacity-20 font-bold uppercase tracking-widest text-[10px]"
              />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        {loading && !data ? (
            <div className="h-full flex items-center justify-center">
                <OrbitalBuffer size={40} className="text-accent" />
            </div>
        ) : (
          <div className="p-8">
            {view === 'tests' && (
                <div className="max-w-5xl mx-auto">
                    <AnimatedList 
                        items={filteredTestsList}
                        className="grid grid-cols-1"
                        gap={16}
                        renderItem={(t) => (
                            <div className="group relative glass-2 p-8 flex items-center gap-8 rounded-[3.5rem] border border-white/5 hover:bg-white/[0.08] hover:border-accent/40 transition-all cursor-pointer active:scale-[0.98] shadow-xl">
                                <div className="w-16 h-16 rounded-3xl bg-accent/10 flex items-center justify-center border border-accent/20 group-hover:bg-accent/20 transition-colors shrink-0 shadow-2xl">
                                    <FiLayers className="text-secondary group-hover:text-accent text-2xl transition-colors" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-xl font-black text-primary truncate tracking-tight uppercase group-hover:text-accent transition-colors">{t.title}</h3>
                                    <div className="flex flex-col gap-1 mt-2">
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 text-secondary">{t.subject}</p>
                                        <div className="flex items-center gap-3 font-black uppercase tracking-widest opacity-20 text-[8px]">
                                            <span>{t.year} · {t.division}</span>
                                            <span>•</span>
                                            <span>{t.submitted_count}/{t.total_attempts} DATASETS</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right pr-4">
                                    <p className="text-2xl font-black tabular-nums tracking-tighter" style={{ color: pctColor(t.avg_percentage) }}>{t.avg_percentage}%</p>
                                    <p className="text-[8px] text-secondary font-black uppercase opacity-40">Accuracy</p>
                                </div>
                            </div>
                        )}
                        onItemSelect={handleSelectTest}
                    />
                </div>
            )}

            {view === 'dashboard' && data && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* Summary stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Total Tests Run"       value={data.total_tests} />
                    <StatCard label="Students Tested"       value={data.total_students_tested} />
                    <StatCard label="Platform Avg Score"    value={`${data.avg_score_across_tests}%`}
                      color={pctColor(data.avg_score_across_tests)} />
                    <StatCard label="Completion Rate"       value={`${data.overall_completion_rate}%`}
                      color={data.overall_completion_rate >= 70 ? '#4ade80' : '#facc15'} />
                  </div>

                  {/* Filter bar */}
                  <div className="glass-2 p-4 flex flex-wrap gap-3 items-end bg-white/[0.01]">
                    <div>
                      <p className="text-xs mb-1 text-secondary opacity-60">Year</p>
                      <GlassSelect 
                        value={filters.year} 
                        onChange={v => setFilters(f => ({ ...f, year: v }))}
                        options={[
                          { value: '', label: 'All Years' },
                          ...['FE','SE','TE','BE'].map(y => ({ value: y, label: y }))
                        ]}
                        className="w-32"
                      />
                    </div>
                    <div>
                      <p className="text-xs mb-1 text-secondary opacity-60">Division</p>
                      <GlassSelect 
                        value={filters.division} 
                        onChange={v => setFilters(f => ({ ...f, division: v }))}
                        options={[
                          { value: '', label: 'All Divisions' },
                          ...['A','B','C','D'].map(d => ({ value: d, label: `Div ${d}` }))
                        ]}
                        className="w-36"
                      />
                    </div>
                    <div>
                      <p className="text-xs mb-1 text-secondary opacity-60">Subject</p>
                      <GlassSelect 
                        value={filters.subject} 
                        onChange={v => setFilters(f => ({ ...f, subject: v }))}
                        options={[
                          { value: '', label: 'All Subjects' },
                          ...subjects.map((s: string) => ({ value: s, label: s }))
                        ]}
                        className="w-44"
                      />
                    </div>
                    <div>
                      <p className="text-xs mb-1 text-secondary opacity-60">Test</p>
                      <GlassSelect 
                        value={filters.test_id} 
                        onChange={v => setFilters(f => ({ ...f, test_id: v }))}
                        options={[
                          { value: '', label: 'All Tests' },
                          ...testOptions.map((t: TestRow) => ({ value: t.id, label: t.title }))
                        ]}
                        className="w-56"
                      />
                    </div>
                    <div>
                      <p className="text-xs mb-1 text-secondary opacity-60">From</p>
                      <input type="date" value={filters.date_from}
                        onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
                        className={`${inputCls} bg-black/5 border-white/10 text-primary`} />
                    </div>
                    <div>
                      <p className="text-xs mb-1 text-secondary opacity-60">To</p>
                      <input type="date" value={filters.date_to}
                        onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
                        className={`${inputCls} bg-black/5 border-white/10 text-primary`} />
                    </div>
                    <button onClick={applyFilters} disabled={loading}
                      className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: 'rgb(var(--accent))' }}>
                      {loading ? 'Loading...' : 'Apply Filters'}
                    </button>
                    {(Object.values(applied).some(Boolean)) && (
                      <button onClick={() => { setFilters({ year:'',division:'',subject:'',test_id:'',date_from:'',date_to:'' }); setApplied({ year:'',division:'',subject:'',test_id:'',date_from:'',date_to:'' }); load({ year:'',division:'',subject:'',test_id:'',date_from:'',date_to:'' }); }}
                        className="text-xs px-3 py-1.5 rounded-lg text-secondary hover:opacity-100 transition-opacity">
                        Clear
                      </button>
                    )}
                  </div>

                  {error && <p className="text-sm text-red-400">{error}</p>}

                  {/* Per-test table */}
                  {data.tests.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold mb-3" style={{ color: 'rgb(var(--text-primary))' }}>
                        Test Analytics
                      </p>
                      <div className="glass-2 overflow-hidden bg-white/[0.01]">
                        <table className="w-full text-sm">
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                              {['Test', 'Subject', 'Year/Div', 'Attempts', 'Avg %', 'Completion', 'Avg Time', 'Hardest Q', ''].map(h => (
                                <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide"
                                  style={{ color: 'rgb(var(--text-secondary))' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {data.tests.map((t: TestRow, i: number) => {
                              const isExp = expandedTest === t.id;
                              return (
                                <Fragment key={t.id}>
                                  <tr
                                    style={{ borderBottom: '1px solid var(--glass-border)', backgroundColor: isExp ? 'rgba(99,102,241,0.05)' : 'transparent' }}>
                                    <td className="px-4 py-3 font-medium max-w-[160px]">
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
                                    <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-primary))' }}>
                                      {t.submitted_count}/{t.total_attempts}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="font-semibold" style={{ color: pctColor(t.avg_percentage) }}>
                                        {t.avg_percentage}%
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="text-xs" style={{ color: pctColor(t.completion_rate) }}>
                                        {t.completion_rate}%
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                                      {t.avg_time_mins > 0 ? `${t.avg_time_mins}m` : '—'}
                                    </td>
                                    <td className="px-4 py-3 max-w-[140px]">
                                      {t.hardest_question ? (
                                        <div>
                                          <p className="text-xs truncate" style={{ color: 'rgb(var(--text-primary))' }}>
                                            {t.hardest_question.statement_preview}
                                          </p>
                                          <p className="text-xs" style={{ color: '#f87171' }}>
                                            {t.hardest_question.correct_rate}% correct
                                          </p>
                                        </div>
                                      ) : <span style={{ color: 'rgb(var(--text-secondary))' }}>—</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex gap-1.5">
                                        <button onClick={() => setExpandedTest(isExp ? null : t.id)}
                                          className="text-xs px-2 py-1 rounded"
                                          style={{ backgroundColor: 'rgba(99,102,241,0.12)', color: 'rgb(var(--accent))' }}>
                                          {isExp ? '▲' : '▼'}
                                        </button>
                                        <button onClick={() => openWindow('integrity', { testId: t.id })}
                                          className="text-xs px-2 py-1 rounded"
                                          style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgb(var(--text-secondary))' }}>
                                          Integrity
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                  {isExp && (
                                    <tr style={{ borderBottom: '1px solid var(--glass-border)', backgroundColor: 'rgba(99,102,241,0.03)' }}>
                                      <td colSpan={9} className="px-6 py-4">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                          {[
                                            { label: 'Total Attempts',  value: t.total_attempts },
                                            { label: 'Submitted',       value: t.submitted_count },
                                            { label: 'Avg Score',       value: `${t.avg_percentage}%` },
                                            { label: 'Avg Time',        value: t.avg_time_mins > 0 ? `${t.avg_time_mins} min` : '—' },
                                          ].map(s => (
                                            <div key={s.label} className="rounded-xl p-3 text-center"
                                              style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}>
                                              <p className="text-lg font-bold" style={{ color: 'rgb(var(--accent))' }}>{s.value}</p>
                                              <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-secondary))' }}>{s.label}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Division comparison chart */}
                  {divCompData.length > 0 && allDivisions.length > 1 && (
                    <div className="glass p-5">
                      <p className="text-sm font-semibold mb-4" style={{ color: 'rgb(var(--text-primary))' }}>
                        Division Comparison
                        {applied.test_id && data.tests.find((t: TestRow) => t.id === applied.test_id) && (
                          <span className="ml-2 text-xs font-normal" style={{ color: 'rgb(var(--text-secondary))' }}>
                            — {data.tests.find((t: TestRow) => t.id === applied.test_id)?.title}
                          </span>
                        )}
                      </p>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={divCompData} barSize={24} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                          <XAxis dataKey="test" tick={axisStyle} axisLine={false} tickLine={false} />
                          <YAxis domain={[0, 100]} tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                          <Tooltip content={<DivTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                          <Legend wrapperStyle={{ fontSize: 11, color: 'rgb(148 163 184)' }} />
                          {allDivisions.map((div: string, i: number) => (
                            <Bar key={div} dataKey={div} name={`Div ${div}`} fill={DIV_COLORS[i % DIV_COLORS.length]}
                              fillOpacity={0.85} radius={[3, 3, 0, 0]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Student performance table */}
                  {students.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                        <p className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
                          Student Performance
                        </p>
                        <div className="flex gap-2">
                          <input type="text" placeholder="Search by name..."
                            value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                            className={`${inputCls} w-44`} style={inputStyle} />
                          <GlassSelect 
                            value={studentSort}
                            onChange={(v) => setStudentSort(v as any)}
                            options={[
                              { value: 'avg', label: 'Sort: Avg %' },
                              { value: 'attempts', label: 'Sort: Attempts' },
                            ]}
                            className="w-44"
                          />
                        </div>
                      </div>
                      <div className="glass overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                              {['Name', 'Year', 'Division', 'Tests', 'Avg %', 'Best Score'].map(h => (
                                <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide"
                                  style={{ color: 'rgb(var(--text-secondary))' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {students.map((s, i) => (
                              <tr key={s.user_id}
                                style={{ borderBottom: i < students.length - 1 ? '1px solid var(--glass-border)' : 'none' }}>
                                <td className="px-4 py-3 font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                                  {s.name}
                                </td>
                                <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>{s.year}</td>
                                <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>{s.division}</td>
                                <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-primary))' }}>{s.tests_attempted}</td>
                                <td className="px-4 py-3">
                                  <span className="font-semibold" style={{ color: pctColor(s.avg_percentage) }}>
                                    {s.avg_percentage}%
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                                  {s.best_score > 0 ? s.best_score : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {data.total_tests === 0 && (
                      <div className="glass-2 p-12 text-center bg-white/[0.01]">
                      <p className="text-lg mb-2" style={{ color: 'rgb(var(--text-primary))' }}>No data yet</p>
                      <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                        Create and run tests to see analytics here.
                      </p>
                    </div>
                  )}
                </div>
            )}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 absolute inset-0 pointer-events-none">
          <OrbitalBuffer size={32} className="text-accent" />
        </div>
      )}
    </div>
  );
}
