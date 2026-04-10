import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import api from '../../lib/axios';
import { useLenis } from '../../hooks/useLenis';
import { useOSStore } from '../store/useOSStore';

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

const DIV_COLORS = ['rgb(99,102,241)', '#4ade80', '#facc15', '#f87171', '#fb923c'];

const axisStyle = { fontSize: 11, fill: 'rgb(148 163 184)' };

const inputCls = 'px-3 py-1.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500';
const inputStyle = {
  backgroundColor: 'rgba(255,255,255,0.07)',
  border: '1px solid var(--glass-border)',
  color: 'rgb(var(--text-primary))',
};

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="glass p-5 text-center">
      <p className="text-2xl font-bold" style={{ color: color ?? 'rgb(var(--accent))' }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>{label}</p>
    </div>
  );
}

function DivTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass px-3 py-2 text-xs space-y-1">
      <p className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill }}>{p.name}: {p.value}%</p>
      ))}
    </div>
  );
}

export default function AdminAnalyticsApp() {
  const lenisRef = useLenis();
  const { openWindow } = useOSStore();

  // Filter state
  const [filters, setFilters] = useState({ year: '', division: '', subject: '', test_id: '', date_from: '', date_to: '' });
  const [applied, setApplied] = useState({ year: '', division: '', subject: '', test_id: '', date_from: '', date_to: '' });

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <div ref={lenisRef} className="h-full overflow-auto p-6 space-y-6">

      <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>Analytics</h1>

      {/* Filter bar */}
      <div className="glass p-4 flex flex-wrap gap-3 items-end">
        <div>
          <p className="text-xs mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>Year</p>
          <select value={filters.year} onChange={e => setFilters(f => ({ ...f, year: e.target.value }))}
            className={inputCls} style={inputStyle}>
            <option value="">All Years</option>
            {['FE','SE','TE','BE'].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>Division</p>
          <select value={filters.division} onChange={e => setFilters(f => ({ ...f, division: e.target.value }))}
            className={inputCls} style={inputStyle}>
            <option value="">All Divisions</option>
            {['A','B','C','D'].map(d => <option key={d} value={d}>Div {d}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>Subject</p>
          <select value={filters.subject} onChange={e => setFilters(f => ({ ...f, subject: e.target.value }))}
            className={inputCls} style={inputStyle}>
            <option value="">All Subjects</option>
            {subjects.map((s: string) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>Test</p>
          <select value={filters.test_id} onChange={e => setFilters(f => ({ ...f, test_id: e.target.value }))}
            className={inputCls} style={inputStyle}>
            <option value="">All Tests</option>
            {testOptions.map((t: TestRow) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>From</p>
          <input type="date" value={filters.date_from}
            onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
            className={inputCls} style={inputStyle} />
        </div>
        <div>
          <p className="text-xs mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>To</p>
          <input type="date" value={filters.date_to}
            onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
            className={inputCls} style={inputStyle} />
        </div>
        <button onClick={applyFilters} disabled={loading}
          className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          style={{ backgroundColor: 'rgb(var(--accent))' }}>
          {loading ? 'Loading...' : 'Apply Filters'}
        </button>
        {(Object.values(applied).some(Boolean)) && (
          <button onClick={() => { setFilters({ year:'',division:'',subject:'',test_id:'',date_from:'',date_to:'' }); setApplied({ year:'',division:'',subject:'',test_id:'',date_from:'',date_to:'' }); load({ year:'',division:'',subject:'',test_id:'',date_from:'',date_to:'' }); }}
            className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-70"
            style={{ color: 'rgb(var(--text-secondary))' }}>
            Clear
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && data && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Tests Run"       value={data.total_tests} />
            <StatCard label="Students Tested"       value={data.total_students_tested} />
            <StatCard label="Platform Avg Score"    value={`${data.avg_score_across_tests}%`}
              color={pctColor(data.avg_score_across_tests)} />
            <StatCard label="Completion Rate"       value={`${data.overall_completion_rate}%`}
              color={data.overall_completion_rate >= 70 ? '#4ade80' : '#facc15'} />
          </div>

          {/* Per-test table */}
          {data.tests.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-3" style={{ color: 'rgb(var(--text-primary))' }}>
                Test Analytics
              </p>
              <div className="glass overflow-hidden">
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
                        <>
                          <tr key={t.id}
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
                            <tr key={`${t.id}-exp`} style={{ borderBottom: '1px solid var(--glass-border)', backgroundColor: 'rgba(99,102,241,0.03)' }}>
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
                        </>
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
                  <select value={studentSort} onChange={e => setStudentSort(e.target.value as any)}
                    className={inputCls} style={inputStyle}>
                    <option value="avg">Sort: Avg %</option>
                    <option value="attempts">Sort: Attempts</option>
                  </select>
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
            <div className="glass p-12 text-center">
              <p className="text-lg mb-2" style={{ color: 'rgb(var(--text-primary))' }}>No data yet</p>
              <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                Create and run tests to see analytics here.
              </p>
            </div>
          )}
        </>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <span className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
