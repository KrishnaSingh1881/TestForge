import { useEffect, useState, useMemo } from 'react';
import api from '../../lib/axios';
import { FiBarChart2, FiSearch, FiSlash, FiLayers, FiArrowLeft } from 'react-icons/fi';
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

export default function StudentResultsApp() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedAttempt, setSelectedAttempt] = useState<any>(null);

  useEffect(() => {
    api.get('/attempts/my')
      .then(r => setResults(r.data.attempts ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSelectTest = async (r: any) => {
    if (r.status === 'absent' || !r.id) return;
    // Show detail view immediately with loading state
    setSelectedAttempt({ loading: true, attempt: { test_title: r.test_title } });
    try {
      const res = await api.get(`/attempts/${r.id}/result`);
      setSelectedAttempt(res.data);
    } catch (err) {
      console.error('Failed to load result details:', err);
      setSelectedAttempt(null);
    }
  };

  const filtered = useMemo(
    () => results.filter(r => r.test_title?.toLowerCase().includes(search.toLowerCase())),
    [results, search]
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
          <FiBarChart2 className="text-accent" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-black text-primary tracking-tight uppercase">
            {selectedAttempt ? selectedAttempt.attempt.test_title : 'My Results'}
          </h1>
          <p className="text-[9px] font-black uppercase text-secondary tracking-widest opacity-30 mt-0.5">
            {selectedAttempt ? 'Detailed breakdown' : 'Your submitted test results'}
          </p>
        </div>
        {!selectedAttempt && (
          <div className="relative w-64">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search results..."
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
              <div className="grid grid-cols-3 gap-4">
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
              </div>

              {/* Question Breakdown */}
              <div className="space-y-3">
                <h3 className="text-sm font-black text-primary uppercase tracking-wide">Question Breakdown</h3>
                {selectedAttempt.breakdown.map((q: any) => (
                  <div key={q.question_id} className={`glass-2 p-6 rounded-2xl border ${q.is_correct ? 'border-green-500/20' : 'border-red-500/20'}`}>
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${q.is_correct ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        <span className="text-sm font-black">{q.number}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-primary font-bold">{q.statement}</p>
                        {q.topic_tag && (
                          <span className="inline-block mt-2 text-[8px] font-black bg-accent/10 text-accent px-2 py-1 rounded-full uppercase tracking-widest">
                            {q.topic_tag}
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-xl font-black ${q.is_correct ? 'text-green-500' : 'text-red-500'}`}>
                          {q.marks_awarded}/{q.marks_total}
                        </p>
                        <p className="text-[8px] font-black text-secondary uppercase tracking-widest opacity-40 mt-1">
                          {q.is_correct ? 'Correct' : 'Incorrect'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )
          ) : filtered.length === 0 ? (
            <div className="py-24 text-center glass-2 border-dashed border-white/10 rounded-[3rem]">
              <FiBarChart2 className="mx-auto text-5xl text-white/10 mb-6" />
              <p className="text-[11px] font-black text-white/20 tracking-[0.5em] uppercase">No results yet</p>
              <p className="text-[9px] font-black text-white/10 tracking-widest uppercase mt-2 opacity-60">
                Complete a test to see your results here
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filtered.map((r) => {
                const isAbsent = r.status === 'absent';
                return (
                  <div 
                    key={r.id || r.test_id}
                    onClick={() => handleSelectTest(r)}
                    className={`glass-2 p-8 rounded-[3rem] border border-white/5 transition-all ${isAbsent ? 'opacity-50 grayscale' : 'hover:bg-white/[0.05] cursor-pointer'}`}
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                        {isAbsent ? <FiSlash className="text-red-400 opacity-60 text-xl" /> : <FiLayers className="text-secondary text-xl" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-black text-primary truncate uppercase tracking-tight">
                            {r.test_title}
                          </h3>
                          {isAbsent && (
                            <span className="text-[8px] font-black bg-red-500/20 text-red-500 px-3 py-1 rounded-full border border-red-500/30 tracking-widest uppercase shrink-0">
                              ABSENT
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-secondary font-black uppercase tracking-[0.3em] opacity-40 mt-1">
                          {isAbsent ? 'Not submitted' : fmtDate(r.submitted_at)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-3xl font-black tabular-nums tracking-tighter" style={{ color: isAbsent ? '#f87171' : pctColor(r.percentage ?? 0) }}>
                          {isAbsent ? '—' : `${Math.round(r.percentage ?? 0)}%`}
                        </p>
                        <p className="text-[10px] font-black text-secondary opacity-40 mt-1 uppercase tracking-widest">
                          {isAbsent ? 'Absent' : `${r.total_score}/${r.total_marks}`}
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
