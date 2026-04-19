import { useEffect, useState, useMemo } from 'react';
import api from '../../lib/axios';
import { FiShield, FiSearch, FiSlash, FiCheckCircle, FiAlertTriangle, FiArrowLeft } from 'react-icons/fi';
import OrbitalBuffer from '../components/OrbitalBuffer';

function scoreColor(score: number | null) {
  if (score === null || score === undefined) return 'rgba(255,255,255,0.4)';
  if (score >= 90) return '#4ade80';
  if (score >= 70) return '#facc15';
  return '#f87171';
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function StudentIntegrityApp() {
  const [integrity, setIntegrity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTest, setSelectedTest] = useState<any>(null);

  useEffect(() => {
    api.get('/attempts/my')
      .then(r => setIntegrity(r.data.attempts ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSelectTest = async (i: any) => {
    if (i.status === 'absent' || !i.test_id) return;
    // Show detail view immediately with loading state
    setSelectedTest({ loading: true, test_title: i.test_title, test_subject: i.test_subject });
    try {
      const res = await api.get(`/attempts/test/${i.test_id}/integrity/me`);
      setSelectedTest({ ...res.data, test_title: i.test_title, test_subject: i.test_subject });
    } catch (err) {
      console.error('Failed to load integrity details:', err);
      setSelectedTest(null);
    }
  };

  const filtered = useMemo(
    () => integrity.filter(i => i.test_title?.toLowerCase().includes(search.toLowerCase())),
    [integrity, search]
  );

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-8 py-6 border-b border-white/5 bg-white/[0.02] shrink-0">
        {selectedTest && (
          <button onClick={() => setSelectedTest(null)} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <FiArrowLeft className="text-secondary" />
          </button>
        )}
        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20 shrink-0">
          <FiShield className="text-red-500" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-black text-primary tracking-tight uppercase">
            {selectedTest ? selectedTest.test_title : 'My Integrity'}
          </h1>
          <p className="text-[9px] font-black uppercase text-secondary tracking-widest opacity-30 mt-0.5">
            {selectedTest ? 'Integrity breakdown' : 'Your test integrity reports'}
          </p>
        </div>
        {!selectedTest && (
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
          ) : selectedTest ? (
            selectedTest.loading ? (
              <div className="h-64 flex items-center justify-center">
                <OrbitalBuffer size={40} className="text-accent" />
              </div>
            ) : (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Behavioral Flags - Prominent Display */}
              {selectedTest.behavioral_flags && selectedTest.behavioral_flags.length > 0 ? (
                <div className="space-y-3">
                  {selectedTest.behavioral_flags.map((flag: any, idx: number) => (
                    <div key={idx} className="glass-2 p-6 rounded-2xl border border-amber-500/20 hover:border-amber-500/40 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                          <FiAlertTriangle className="text-amber-500 text-xl" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-black text-primary uppercase tracking-tight">{flag.label}</h3>
                          <p className="text-[9px] text-secondary font-black uppercase tracking-widest opacity-40 mt-1">
                            {flag.question_id ? `Question #${flag.question_id}` : 'General'}
                          </p>
                        </div>
                        <span className="text-[8px] font-black bg-amber-500/20 text-amber-500 px-3 py-1.5 rounded-full uppercase tracking-widest shrink-0">
                          MEDIUM
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-2 p-12 rounded-2xl text-center border border-green-500/20">
                  <FiCheckCircle className="mx-auto text-5xl text-green-500 mb-4" />
                  <p className="text-lg font-black text-primary uppercase tracking-wide">No Flags Detected</p>
                  <p className="text-xs text-secondary mt-2 uppercase tracking-widest opacity-60">Your test session had no behavioral anomalies</p>
                </div>
              )}

              {/* Coding Analysis Section */}
              <div className="glass-2 p-6 rounded-2xl">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-1 h-4 bg-accent rounded-full" />
                  <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.3em] opacity-60">Coding Analysis (0)</h3>
                </div>

                {/* Question Metrics Grid */}
                <div className="space-y-4">
                  {selectedTest.behavioral_detail && selectedTest.behavioral_detail.length > 0 ? (
                    selectedTest.behavioral_detail.map((detail: any, idx: number) => (
                      <div key={idx} className="p-4 bg-white/5 rounded-xl">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-black text-secondary uppercase tracking-widest">Q{detail.question_id}</span>
                          <span className="text-[8px] font-black bg-green-500/20 text-green-500 px-2 py-1 rounded-full uppercase tracking-widest">
                            AUTHENTIC
                          </span>
                        </div>
                        <div className="grid grid-cols-6 gap-3">
                          <div className="text-center">
                            <p className="text-lg font-black text-primary">{detail.time_to_first_keystroke || '—'}</p>
                            <p className="text-[7px] font-black text-secondary uppercase tracking-widest opacity-40 mt-1">Time to Start</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-black text-primary">{detail.wpm_consistency || '—'}</p>
                            <p className="text-[7px] font-black text-secondary uppercase tracking-widest opacity-40 mt-1">Consistency</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-black text-primary">{detail.backspace_count || 0}</p>
                            <p className="text-[7px] font-black text-secondary uppercase tracking-widest opacity-40 mt-1">Corrections</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-black text-primary">{detail.paste_events || 0}</p>
                            <p className="text-[7px] font-black text-secondary uppercase tracking-widest opacity-40 mt-1">Paste Events</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-black text-primary">{detail.edit_count || 0}</p>
                            <p className="text-[7px] font-black text-secondary uppercase tracking-widest opacity-40 mt-1">Edits</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-black text-primary">{detail.test_runs_before_submit || 0}</p>
                            <p className="text-[7px] font-black text-secondary uppercase tracking-widest opacity-40 mt-1">Test Runs</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-xs text-secondary uppercase tracking-widest opacity-40">No coding questions in this test</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Idle Gaps Section */}
              <div className="glass-2 p-6 rounded-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-4 bg-accent rounded-full" />
                  <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.3em] opacity-60">Idle Gaps</h3>
                </div>
                <div className="text-center py-8">
                  <p className="text-2xl font-black text-amber-500">10m</p>
                  <p className="text-[8px] text-secondary uppercase tracking-widest opacity-40 mt-2">Total idle time detected</p>
                </div>
              </div>

              {/* Session Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="glass-2 p-6 rounded-2xl text-center">
                  <p className="text-3xl font-black text-primary">{selectedTest.tab_switches ?? 0}</p>
                  <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40 mt-2">Tab Switches</p>
                </div>
                <div className="glass-2 p-6 rounded-2xl text-center">
                  <p className="text-3xl font-black text-primary">{selectedTest.focus_lost_count ?? 0}</p>
                  <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40 mt-2">Focus Lost</p>
                </div>
                <div className="glass-2 p-6 rounded-2xl text-center">
                  <p className="text-3xl font-black text-primary">{selectedTest.behavioral_flags?.length ?? 0}</p>
                  <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40 mt-2">Total Flags</p>
                </div>
              </div>
            </div>
            )
          ) : filtered.length === 0 ? (
            <div className="py-24 text-center glass-2 border-dashed border-white/10 rounded-[3rem]">
              <FiShield className="mx-auto text-5xl text-white/10 mb-6" />
              <p className="text-[11px] font-black text-white/20 tracking-[0.5em] uppercase">No integrity data yet</p>
              <p className="text-[9px] font-black text-white/10 tracking-widest uppercase mt-2 opacity-60">
                Complete a test to see your integrity reports here
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filtered.map((i) => {
                const isAbsent = i.status === 'absent';
                return (
                  <div 
                    key={i.id || i.test_id}
                    onClick={() => handleSelectTest(i)}
                    className={`glass-2 p-8 rounded-[3rem] border border-white/5 transition-all ${isAbsent ? 'opacity-50 grayscale' : 'hover:bg-white/[0.05] cursor-pointer active:scale-[0.99]'}`}
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                        {isAbsent ? <FiSlash className="text-red-400 opacity-60 text-xl" /> : <FiShield className="text-secondary text-xl" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-black text-primary truncate uppercase tracking-tight">
                            {i.test_title}
                          </h3>
                          {isAbsent && (
                            <span className="text-[8px] font-black bg-red-500/20 text-red-500 px-3 py-1 rounded-full border border-red-500/30 tracking-widest uppercase shrink-0">
                              ABSENT
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-secondary font-black uppercase tracking-[0.3em] opacity-40 mt-1">
                          {isAbsent ? 'Not submitted' : fmtDate(i.submitted_at)}
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
