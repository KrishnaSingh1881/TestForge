
import { useEffect, useMemo, useState } from 'react';
import api from '../../lib/axios';
import AnimatedList from '../../components/AnimatedList';
import { FiArrowLeft, FiSearch, FiChevronRight, FiUser, FiCalendar, FiShield, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import { GlassIcon } from '../components/AppIcons';

interface BehavioralFlag { type: string; label: string; question_id: string; }
interface BehavioralDetail {
  question_id: string;
  time_to_first_keystroke: number | null;
  paste_events: number;
  backspace_count: number;
  edit_count: number;
  wpm_consistency: number;
  test_runs_before_submit: number;
  idle_periods: { start: string; duration_seconds: number }[];
}
interface AttemptRow {
  attempt_id: string;
  student_name: string;
  student_email: string;
  division: string;
  year: string;
  tab_switches: number;
  focus_lost_count: number;
  integrity_score: number | null;
  total_score: number | null;
  total_marks: number | null;
  percentage: number | null;
  similarity_flag_count: number;
  behavioral_flags: BehavioralFlag[];
  behavioral_detail: BehavioralDetail[];
}

interface SimilarityFlag {
  id: string;
  similarity_score: number;
  admin_verdict: 'pending' | 'confirmed' | 'dismissed';
  reviewed: boolean;
  flagged_at: string;
  question_id: string;
  question_statement: string;
  attempt_id_1: string;
  attempt_id_2: string;
  student1: string;
  student2: string;
  code1: string | null;
  code2: string | null;
  language: string;
}

function scoreColor(score: number | null) {
  if (score === null) return 'rgba(255,255,255,0.4)';
  if (score >= 80) return '#4ade80';
  if (score >= 60) return '#facc15';
  return '#f87171';
}

function StatBox({ label, value, color, icon: Icon }: { label: string; value: string | number; color?: string; icon?: any }) {
  return (
    <div className="glass p-5 flex flex-col items-center justify-center text-center group hover:bg-white/[0.05] transition-all">
      {Icon && <Icon className="text-xl mb-3 opacity-40 group-hover:scale-110 transition-transform" style={{ color }} />}
      <p className="text-2xl font-black tabular-nums tracking-tighter" style={{ color: color ?? 'rgb(var(--accent))' }}>{value}</p>
      <p className="text-[10px] uppercase font-black tracking-widest mt-1.5 text-white/30">{label}</p>
    </div>
  );
}

function BehavioralPanel({ detail, flags }: { detail: BehavioralDetail[]; flags: BehavioralFlag[] }) {
  if (!detail.length) return <p className="text-[10px] py-4 text-center font-bold text-white/30 uppercase tracking-widest">No coding telemetry found.</p>;

  return (
    <div className="space-y-4 pt-1">
      {flags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {flags.map((f, i) => (
            <span key={i} className="text-[9px] font-black uppercase tracking-[0.15em] px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
              {f.label}
            </span>
          ))}
        </div>
      )}

      {detail.map((d, i) => (
        <div key={i} className="rounded-2xl p-4 bg-white/[0.03] border border-white/5 shadow-inner">
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
              Coding Question {i + 1}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {[
              { label: 'Latency',  value: d.time_to_first_keystroke != null ? `${(d.time_to_first_keystroke / 1000).toFixed(1)}s` : '—' },
              { label: 'Paste Ev.',  value: d.paste_events, warn: d.paste_events > 0 },
              { label: 'Backspaces', value: d.backspace_count, warn: d.backspace_count === 0 },
              { label: 'Complexity', value: d.edit_count },
              { label: 'WPM Cons.',  value: d.wpm_consistency },
              { label: 'Unit Tests', value: d.test_runs_before_submit },
            ].map((s, idx) => (
              <div key={idx} className="flex flex-col">
                <p className="text-sm font-black text-white" style={{ color: (s as any).warn ? '#f87171' : 'white' }}>{s.value}</p>
                <p className="text-[9px] font-bold text-white/20 uppercase tracking-tighter mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function IntegrityApp({ testId, testTitle }: { testId?: string; testTitle?: string }) {
  const [view, setView] = useState<'tests' | 'students' | 'details'>('tests');
  const [selectedTest, setSelectedTest] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [tests, setTests] = useState<any[]>([]);
  const [integrityData, setIntegrityData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Filtering
  const [divFilter, setDivFilter] = useState('');
  const [scoreFilter, setScoreFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  useEffect(() => {
    if (testId) {
      setSelectedTest({ id: testId, title: testTitle || 'Selected Test' });
      setView('students');
    } else {
      loadTests();
    }
  }, [testId, testTitle]);

  async function loadTests() {
    setLoading(true);
    try {
      const r = await api.get('/tests');
      setTests(r.data.tests ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function loadIntegrity(tId: string) {
    setLoading(true);
    try {
      const r = await api.get(`/admin/tests/${tId}/integrity`);
      setIntegrityData(r.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (view === 'students' && selectedTest) {
      loadIntegrity(selectedTest.id);
    }
  }, [view, selectedTest]);

  const filteredTests = useMemo(() => {
    return tests.filter(t => 
        (t.title ?? '').toLowerCase().includes(search.toLowerCase()) || 
        (t.subject ?? '').toLowerCase().includes(search.toLowerCase())
    );
  }, [tests, search]);

  const rows = useMemo(() => {
    if (!integrityData) return [];
    let list = [...integrityData.attempts];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => 
        (a.student_name ?? '').toLowerCase().includes(q) || 
        (a.student_email ?? '').toLowerCase().includes(q)
      );
    }
    if (divFilter) list = list.filter(a => a.division === divFilter);
    if (scoreFilter === 'high')   list = list.filter(a => (a.integrity_score ?? 100) >= 80);
    if (scoreFilter === 'medium') list = list.filter(a => (a.integrity_score ?? 100) >= 60 && (a.integrity_score ?? 100) < 80);
    if (scoreFilter === 'low')    list = list.filter(a => (a.integrity_score ?? 100) < 60);

    return list;
  }, [integrityData, search, divFilter, scoreFilter]);

  const handleBack = () => {
    if (view === 'students') {
        if (testId) {
            // Can't go back further
        } else {
            setView('tests');
            setSearch('');
        }
    }
  };

  return (
    <div className="h-full flex flex-col bg-transparent">
      {/* App Header */}
      <div className="flex items-center gap-4 p-6 border-b border-white/5">
        {(view !== 'tests' || (view === 'tests' && testId)) && (
          <button onClick={handleBack} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <FiArrowLeft className="text-white" />
          </button>
        )}
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <FiShield className="text-indigo-500" />
            {view === 'tests' ? "Integrity Hub" : (selectedTest?.title || "Test Monitoring")}
          </h1>
          <p className="text-[10px] font-black uppercase text-white/30 tracking-widest mt-0.5">
            {view === 'tests' ? "Select a test to analyze behavioral patterns" : `Analyzing ${rows.length} active sessions`}
          </p>
        </div>
        
        <div className="relative w-64">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input 
                type="text" 
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            />
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        {loading ? (
            <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Querying Database</p>
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
                  <div className="group relative glass p-5 flex items-center gap-5 transition-all hover:bg-white/[0.08] hover:border-indigo-500/30">
                    <div className="p-3 bg-indigo-500/10 rounded-2xl group-hover:bg-indigo-500/20 transition-all duration-500">
                        <GlassIcon id="shield" size="sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold text-base truncate tracking-tight">{t.title}</h3>
                        <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-white/5 rounded text-white/40">{t.subject}</span>
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-white/5 rounded text-white/40">{t.year} • {t.division}</span>
                        </div>
                    </div>
                    <FiChevronRight className="text-white/10 group-hover:text-white group-hover:translate-x-1 transition-all" />
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
              <div className="space-y-6">
                {/* Dashboard Stats */}
                {integrityData?.summary && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                        <StatBox label="Total Participants" value={integrityData.summary.total} icon={FiUser} />
                        <StatBox label="Avg Integrity" value={`${integrityData.summary.avg_integrity}%`} color={scoreColor(integrityData.summary.avg_integrity)} icon={FiCheckCircle} />
                        <StatBox label="High-Risk Flags" value={integrityData.summary.high_risk} color="#f87171" icon={FiAlertTriangle} />
                        <StatBox label="Active Monitoring" value="LIVE" color="#4ade80" icon={FiShield} />
                    </div>
                )}

                <div className="flex items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/5 overflow-x-auto whitespace-nowrap scrollbar-hide">
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-widest px-4 mr-2 border-r border-white/10">Quick Filters:</p>
                    <button onClick={() => setScoreFilter('all')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${scoreFilter === 'all' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'text-white/40 hover:bg-white/5'}`}>All</button>
                    <button onClick={() => setScoreFilter('low')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${scoreFilter === 'low' ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'text-white/40 hover:bg-white/5'}`}>High Risk</button>
                    <button onClick={() => setScoreFilter('medium')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${scoreFilter === 'medium' ? 'bg-yellow-500 text-white shadow-lg shadow-yellow-500/30' : 'text-white/40 hover:bg-white/5'}`}>Review Required</button>
                </div>

                <AnimatedList 
                  items={rows}
                  containerClassName="w-full"
                  className="flex flex-col gap-3"
                  renderItem={(row) => {
                    const isExpanded = expanded === row.attempt_id;
                    const sc = row.integrity_score;
                    const color = scoreColor(sc);

                    return (
                        <div className={`overflow-hidden rounded-2xl border transition-all duration-300 ${isExpanded ? 'bg-white/[0.08] border-indigo-500/40 shadow-2xl' : 'bg-white/[0.03] border-white/5 hover:border-white/20'}`}>
                            <div className="p-4 flex items-center gap-4 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : row.attempt_id)}>
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:rotate-6 transition-all">
                                    <FiUser className="text-white/40 text-lg" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-black text-white truncate uppercase tracking-tight">{row.student_name}</h3>
                                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">{row.division} • {row.year}</p>
                                </div>
                                <div className="hidden sm:flex flex-col items-center px-4 border-l border-r border-white/5">
                                    <p className="text-[10px] font-black text-white/20 uppercase tracking-tighter mb-0.5">Tab Sw.</p>
                                    <p className={`text-sm font-black ${row.tab_switches > 0 ? 'text-red-400' : 'text-white/40'}`}>{row.tab_switches}</p>
                                </div>
                                <div className="text-right px-2 min-w-[70px]">
                                    <p className="text-[10px] font-black text-white/20 uppercase tracking-tighter mb-0.5">Integrity</p>
                                    <p className="text-sm font-black" style={{ color }}>{sc ?? '--'}%</p>
                                </div>
                                <div className={`w-8 h-8 flex items-center justify-center transition-transform duration-500 ${isExpanded ? 'rotate-180' : ''}`}>
                                    <FiChevronRight className="text-white/20" />
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="px-6 pb-6 pt-2 border-t border-white/5 animate-in slide-in-from-top-2 duration-300">
                                    <div className="mb-4 flex items-center gap-2">
                                        <div className="h-px flex-1 bg-white/5" />
                                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">Behavioral Telemetry</p>
                                        <div className="h-px flex-1 bg-white/5" />
                                    </div>
                                    <BehavioralPanel
                                        detail={row.behavioral_detail}
                                        flags={row.behavioral_flags}
                                    />
                                </div>
                            )}
                        </div>
                    );
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
