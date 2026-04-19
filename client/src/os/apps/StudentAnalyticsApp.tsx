import { useEffect, useState, useMemo } from 'react';
import api from '../../lib/axios';
import { FiBarChart2, FiSearch, FiSlash, FiTrendingUp, FiArrowLeft } from 'react-icons/fi';
import OrbitalBuffer from '../components/OrbitalBuffer';

function pctColor(pct: number) {
  if (pct >= 90) return '#4ade80';
  if (pct >= 70) return '#facc15';
  if (pct >= 50) return '#fb923c';
  return '#f87171';
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function StudentAnalyticsApp() {
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedAttempt, setSelectedAttempt] = useState<any>(null);

  useEffect(() => {
    api.get('/attempts/my')
      .then(r => setAnalytics(r.data.attempts ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSelectTest = async (a: any) => {
    if (a.status === 'absent' || !a.id) return;
    // Show detail view immediately with loading state
    setSelectedAttempt({ loading: true, attempt: { test_title: a.test_title } });
    try {
      const res = await api.get(`/attempts/${a.id}/result`);
      setSelectedAttempt(res.data);
    } catch (err) {
      console.error('Failed to load analytics details:', err);
      setSelectedAttempt(null);
    }
  };

  const filtered = useMemo(
    () => analytics.filter(a => a.test_title?.toLowerCase().includes(search.toLowerCase())),
    [analytics, search]
  );

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-8 py-6 border-b border-white/5 bg-white/[0.02] shrink-0">
        {selectedAttempt && (
          <button onClick={() => setSelectedAttempt(null)} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <FiArrowLeft className="text-secondary" />
          </button>
        )}
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20 shrink-0">
          <FiTrendingUp className="text-accent" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-black text-primary tracking-tight uppercase">
            {selectedAttempt ? selectedAttempt.attempt.test_title : 'My Analytics'}
          </h1>
          <p className="text-[9px] font-black uppercase text-secondary tracking-widest opacity-30 mt-0.5">
            {selectedAttempt ? 'Performance breakdown' : 'Your performance insights'}
          </p>
        </div>
        {!selectedAttempt && (
          <div className="relative w-64">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tests..."
              className="w-full pl-11 pr-4 py-2.5 bg-black/10 border border-white/10 rounded-2xl text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all placeholder:text-white/10 font-bold"
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto custom-scrollbar p-8">
        <div className="max-w-5xl mx-auto">
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <OrbitalBuffer size={40} className="text-accent" />
            </div>
          ) : selectedAttempt ? (
            selectedAttempt.loading ? (
              <div className="h-64 flex items-center justify-center">
                <OrbitalBuffer size={40} className="text-accent" />
              </div>
            ) : (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="glass-2 p-6 rounded-2xl text-center">
                  <p className="text-3xl font-black" style={{ color: pctColor(selectedAttempt.result.percentage) }}>
                    {Math.round(selectedAttempt.result.percentage)}%
                  </p>
                  <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40 mt-2">Score</p>
                </div>
                <div className="glass-2 p-6 rounded-2xl text-center">
                  <p className="text-3xl font-black text-primary">
                    {selectedAttempt.result.total_score}/{selectedAttempt.result.total_marks}
                  </p>
                  <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40 mt-2">Points</p>
                </div>
                <div className="glass-2 p-6 rounded-2xl text-center">
                  <p className="text-3xl font-black text-primary">{selectedAttempt.attempt.time_taken_mins ?? '—'}m</p>
                  <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40 mt-2">Time</p>
                </div>
                <div className="glass-2 p-6 rounded-2xl text-center">
                  <p className="text-3xl font-black text-primary">
                    {selectedAttempt.breakdown.filter((q: any) => q.is_correct).length}/{selectedAttempt.breakdown.length}
                  </p>
                  <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40 mt-2">Correct</p>
                </div>
              </div>

              {/* Section Scores */}
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-2 p-6 rounded-2xl">
                  <h3 className="text-sm font-black text-primary uppercase tracking-wide mb-4">MCQ Performance</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black" style={{ color: pctColor((selectedAttempt.section_scores.mcqScore / selectedAttempt.section_scores.mcqTotal) * 100) }}>
                      {selectedAttempt.section_scores.mcqScore}/{selectedAttempt.section_scores.mcqTotal}
                    </span>
                    <span className="text-sm font-black text-secondary">
                      {Math.round((selectedAttempt.section_scores.mcqScore / selectedAttempt.section_scores.mcqTotal) * 100)}%
                    </span>
                  </div>
                </div>
                <div className="glass-2 p-6 rounded-2xl">
                  <h3 className="text-sm font-black text-primary uppercase tracking-wide mb-4">Debugging Performance</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black" style={{ color: pctColor((selectedAttempt.section_scores.debugScore / selectedAttempt.section_scores.debugTotal) * 100) }}>
                      {selectedAttempt.section_scores.debugScore}/{selectedAttempt.section_scores.debugTotal}
                    </span>
                    <span className="text-sm font-black text-secondary">
                      {Math.round((selectedAttempt.section_scores.debugScore / selectedAttempt.section_scores.debugTotal) * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Time Analysis */}
              <div className="glass-2 p-6 rounded-2xl">
                <h3 className="text-sm font-black text-primary uppercase tracking-wide mb-4">Time Analysis</h3>
                <div className="space-y-3">
                  {selectedAttempt.breakdown.map((q: any) => (
                    <div key={q.question_id} className="flex items-center gap-4">
                      <span className="text-xs font-black text-secondary w-16">Q{q.number}</span>
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-accent/50 rounded-full transition-all"
                          style={{ width: `${Math.min((q.time_spent_seconds / 300) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-black text-secondary w-16 text-right">
                        {q.time_spent_seconds ? `${Math.floor(q.time_spent_seconds / 60)}:${String(q.time_spent_seconds % 60).padStart(2, '0')}` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            )
          ) : filtered.length === 0 ? (
            <div className="py-24 text-center glass-2 border-dashed border-white/10 rounded-[3rem]">
              <FiBarChart2 className="mx-auto text-5xl text-white/10 mb-6" />
              <p className="text-[11px] font-black text-white/20 tracking-[0.5em] uppercase">No analytics yet</p>
              <p className="text-[9px] font-black text-white/10 tracking-widest uppercase mt-2 opacity-60">
                Complete a test to see your analytics here
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filtered.map((a) => {
                const isAbsent = a.status === 'absent';
                return (
                  <div 
                    key={a.id || a.test_id}
                    onClick={() => handleSelectTest(a)}
                    className={`glass-2 p-8 rounded-[3rem] border border-white/5 transition-all ${isAbsent ? 'opacity-50 grayscale' : 'hover:bg-white/[0.05] cursor-pointer'}`}
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                        {isAbsent ? <FiSlash className="text-red-400 opacity-60 text-xl" /> : <FiTrendingUp className="text-secondary text-xl" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-black text-primary truncate uppercase tracking-tight">
                            {a.test_title}
                          </h3>
                          {isAbsent && (
                            <span className="text-[8px] font-black bg-red-500/20 text-red-500 px-3 py-1 rounded-full border border-red-500/30 tracking-widest uppercase shrink-0">
                              ABSENT
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-secondary font-black uppercase tracking-[0.3em] opacity-40 mt-1">
                          {isAbsent ? 'Not submitted' : fmtDate(a.submitted_at)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-3xl font-black tabular-nums tracking-tighter" style={{ color: isAbsent ? '#f87171' : pctColor(a.percentage ?? 0) }}>
                          {isAbsent ? '—' : `${Math.round(a.percentage ?? 0)}%`}
                        </p>
                        <p className="text-[10px] font-black text-secondary opacity-40 mt-1 uppercase tracking-widest">
                          {isAbsent ? 'Absent' : `${a.total_score}/${a.total_marks}`}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
