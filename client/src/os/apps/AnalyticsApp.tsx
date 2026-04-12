
import { useEffect, useState, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import api from '../../lib/axios';
import { useOSStore } from '../store/useOSStore';
import { FiActivity, FiTarget, FiBox, FiSearch, FiArrowLeft, FiChevronRight, FiCheckCircle, FiBarChart2, FiSlash } from 'react-icons/fi';
import AnimatedList from '../../components/AnimatedList';

function pctColor(pct: number) {
  if (pct >= 75) return '#4ade80';
  if (pct >= 50) return '#facc15';
  return '#f87171';
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// This is shown in the drill-down detail for a specific attempt
function AttemptDetail({ attemptId, onBack }: { attemptId: string; onBack: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/analytics/student')
      .then(r => { setData(r.data); setError(''); })
      .catch(e => setError(e.response?.data?.error ?? 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="h-full flex items-center justify-center">
      <p className="text-red-400 text-sm font-bold">{error}</p>
    </div>
  );

  if (!data || data.tests_attempted === 0) return (
    <div className="h-full flex items-center justify-center flex-col gap-4">
      <FiBarChart2 className="text-4xl text-white/10" />
      <p className="text-[10px] font-black text-white/20 tracking-[0.4em] uppercase">No analytics data yet</p>
    </div>
  );

  const mcqAcc  = data.question_type_accuracy?.mcq       ?? null;
  const dbgAcc  = data.question_type_accuracy?.debugging  ?? null;
  const avgTime = data.avg_time_per_question_type;

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-6 pb-16">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Trials"  value={data.tests_attempted}       icon={FiBox} />
        <StatCard label="Avg Score"     value={`${data.avg_percentage}%`}  color={pctColor(data.avg_percentage)}  icon={FiTarget} />
        <StatCard label="Peak Rank"     value={data.best_rank ? `#${data.best_rank}` : '—'} color="rgb(var(--accent))" icon={FiActivity} />
        <StatCard label="Precision"     value={`${data.overall_accuracy}%`} color={pctColor(data.overall_accuracy)} icon={FiTarget} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Score trend */}
        <div className="glass no-shadow p-8 rounded-[2.5rem] border-white/5 space-y-4">
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-secondary opacity-40 flex items-center gap-3">
            <FiActivity className="text-indigo-400" /> Progression Trajectory
          </p>
          {data.score_trend?.length > 0 ? (
            <div className="h-52 w-full">
              <ResponsiveContainer>
                <LineChart data={data.score_trend} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.2)', fontWeight: 900 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.2)', fontWeight: 900 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip
                    contentStyle={{ background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }}
                    formatter={(v: any) => [`${Math.round(v)}%`, 'Score']}
                    labelFormatter={fmtDate}
                  />
                  <Line type="monotone" dataKey="percentage" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', r: 4 }} activeDot={{ r: 6, fill: '#fff' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center">
              <p className="text-[10px] text-white/20 font-black uppercase tracking-widest">Need 2+ attempts for trend</p>
            </div>
          )}
        </div>

        {/* Subject breakdown */}
        <div className="glass no-shadow p-8 rounded-[2.5rem] border-white/5 space-y-4">
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-secondary opacity-40 flex items-center gap-3">
            <FiTarget className="text-indigo-400" /> Domain Mastery
          </p>
          {data.subject_performance?.length > 0 ? (
            <div className="h-52 w-full">
              <ResponsiveContainer>
                <BarChart data={data.subject_performance} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                  <XAxis dataKey="subject" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.2)', fontWeight: 900 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.2)', fontWeight: 900 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Bar dataKey="avg_percentage" radius={[8, 8, 8, 8]}>
                    {data.subject_performance.map((s: any, i: number) => (
                      <Cell key={i} fill={pctColor(s.avg_percentage)} fillOpacity={0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center">
              <p className="text-[10px] text-white/20 font-black uppercase tracking-widest">No subject data</p>
            </div>
          )}
        </div>
      </div>

      {/* MCQ vs Debug accuracy breakdown */}
      {(mcqAcc !== null || dbgAcc !== null) && (
        <div className="glass no-shadow p-8 rounded-[2.5rem] border-white/5 space-y-6">
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-secondary opacity-40">Question Type Accuracy</p>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { label: 'MCQ Accuracy',       val: mcqAcc, icon: '☑', color: '#6366f1' },
              { label: 'Debugging Accuracy', val: dbgAcc, icon: '🐛', color: '#f43f5e' },
            ].map(({ label, val, icon, color }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-secondary uppercase tracking-widest opacity-60">{icon} {label}</span>
                  <span className="text-sm font-black tabular-nums" style={{ color }}>{val !== null ? `${Math.round(val)}%` : '—'}</span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${val ?? 0}%`, background: color, opacity: 0.7 }} />
                </div>
              </div>
            ))}
          </div>
          {avgTime && (
            <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
              {[
                { label: 'Avg time/MCQ',   val: avgTime.mcq       ? `${Math.round(avgTime.mcq)}s` : '—' },
                { label: 'Avg time/Debug', val: avgTime.debugging ? `${Math.round(avgTime.debugging / 60)}m` : '—' },
              ].map(m => (
                <div key={m.label} className="text-center">
                  <p className="text-[8px] font-black text-secondary uppercase tracking-widest opacity-30 mb-1">{m.label}</p>
                  <p className="text-lg font-black text-primary">{m.val}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Test history table */}
      {data.score_trend?.length > 0 && (
        <div className="glass no-shadow p-8 rounded-[2.5rem] border-white/5 space-y-4">
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-secondary opacity-40">All Attempts</p>
          <div className="space-y-2">
            {data.score_trend.map((t: any, i: number) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] transition-all">
                <div className="w-2 h-8 rounded-full shrink-0" style={{ background: pctColor(t.percentage), opacity: 0.7 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-primary truncate uppercase tracking-tight">{t.test_title ?? 'Test'}</p>
                  <p className="text-[8px] font-black text-secondary uppercase tracking-widest opacity-30">{fmtDate(t.date)}</p>
                </div>
                {t.rank && <span className="text-[9px] font-black text-secondary opacity-40 uppercase tracking-widest">#{t.rank}</span>}
                <p className="text-sm font-black tabular-nums shrink-0" style={{ color: pctColor(t.percentage) }}>
                  {Math.round(t.percentage)}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsApp({ attemptId: initialAttemptId }: { attemptId?: string }) {
  const { openWindow } = useOSStore();

  const [view, setView] = useState<'list' | 'detail'>(initialAttemptId ? 'detail' : 'list');
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(initialAttemptId || null);
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const loadList = async () => {
    setListLoading(true);
    try {
      const r = await api.get('/attempts/my');
      setHistory(r.data.attempts || []);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    // Always load the list (need it for both views)
    loadList();
  }, []);

  // If launched with an attemptId, go straight to detail
  useEffect(() => {
    if (initialAttemptId) {
      setSelectedAttemptId(initialAttemptId);
      setView('detail');
    }
  }, [initialAttemptId]);

  const filteredHistory = useMemo(() =>
    history.filter(h => (h.test_title || '').toLowerCase().includes(search.toLowerCase())),
    [history, search]
  );

  const handleBack = () => {
    if (view === 'detail' && !initialAttemptId) {
      setView('list');
      setSelectedAttemptId(null);
    } else {
      openWindow('tests');
    }
  };

  return (
    <div className="h-full flex flex-col bg-transparent animate-in fade-in duration-500 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 p-6 border-b border-white/5 bg-black/5 shrink-0">
        <button onClick={handleBack} className="p-2.5 rounded-xl hover:bg-white/10 transition-colors border border-white/5 active:scale-95">
          <FiArrowLeft className="text-secondary" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-black text-primary tracking-tight flex items-center gap-3">
            <FiBarChart2 className="text-indigo-500" />
            {view === 'list' ? 'Diagnostics Registry' : 'Performance Analytics'}
          </h1>
          <p className="text-[10px] font-black uppercase text-secondary tracking-widest mt-0.5 opacity-40">
            {view === 'list' ? 'Select a concluded trial to view analytics' : 'Your full academic performance trajectory'}
          </p>
        </div>

        {view === 'list' && (
          <div className="relative w-64">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
            <input
              type="text"
              placeholder="Search trials..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-black/10 border border-white/10 rounded-2xl text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-white/10 font-bold"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        {view === 'list' ? (
          <div className="p-8 max-w-5xl mx-auto">
            {listLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="py-24 text-center glass no-shadow border-dashed border-white/10 rounded-[2.5rem]">
                <FiBarChart2 className="mx-auto text-4xl text-white/10 mb-4" />
                <p className="text-[10px] font-black text-white/20 tracking-[0.5em] uppercase">No concluded trials found</p>
                <p className="text-[9px] text-white/10 font-bold mt-2 uppercase tracking-widest">Complete a test to see your analytics</p>
              </div>
            ) : (
              <AnimatedList
                items={filteredHistory}
                className="flex flex-col gap-3"
                renderItem={(h) => {
                  const isAbsent = h.status === 'absent';
                  return (
                    <div
                      onClick={() => {
                        if (!isAbsent) {
                          setSelectedAttemptId(h.id);
                          setView('detail');
                        }
                      }}
                      className={`group glass no-shadow p-5 flex items-center gap-6 transition-all border-white/5 rounded-[1.5rem] ${
                        isAbsent
                          ? 'cursor-not-allowed opacity-50'
                          : 'hover:bg-white/[0.08] hover:border-indigo-500/30 cursor-pointer'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5 transition-all">
                        {isAbsent
                          ? <FiSlash className="text-red-400 opacity-60" />
                          : <FiCheckCircle className="text-secondary group-hover:text-indigo-400 text-xl" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <h3 className="text-base font-black text-primary truncate uppercase tracking-tight">{h.test_title}</h3>
                          {isAbsent && (
                            <span className="text-[8px] font-black bg-red-500/20 text-red-400 px-2 py-0.5 rounded tracking-widest uppercase shrink-0">
                              Absent
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] text-secondary font-black uppercase tracking-widest opacity-40 mt-1">
                          {isAbsent ? 'Analytics Unavailable' : `Concluded ${fmtDate(h.submitted_at)}`}
                        </p>
                      </div>
                      <div className="text-right mr-4">
                        <p className="text-xl font-black tabular-nums tracking-tighter"
                          style={{ color: isAbsent ? '#f87171' : pctColor(h.percentage ?? 0) }}>
                          {isAbsent ? '—' : `${Math.round(h.percentage ?? 0)}%`}
                        </p>
                        <p className="text-[9px] font-black text-secondary uppercase opacity-30">
                          {isAbsent ? 'No Entry' : `${h.total_score}/${h.total_marks} pts`}
                        </p>
                      </div>
                      {!isAbsent && (
                        <FiChevronRight className="text-secondary opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                      )}
                    </div>
                  );
                }}
              />
            )}
          </div>
        ) : (
          <AttemptDetail attemptId={selectedAttemptId!} onBack={handleBack} />
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon: Icon }: { label: string; value: string | number; color?: string; icon?: any }) {
  return (
    <div className="glass no-shadow p-6 rounded-[2rem] border-white/5 flex flex-col items-center justify-center text-center group">
      {Icon && <Icon className="text-indigo-400/20 mb-3 text-xl group-hover:scale-110 group-hover:text-indigo-400 transition-all" />}
      <p className="text-2xl font-black tracking-tighter" style={{ color: color ?? 'rgb(var(--accent))' }}>{value}</p>
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-secondary opacity-40 mt-1">{label}</p>
    </div>
  );
}
