import { useEffect, useState, useMemo } from 'react';
import api from '../../lib/axios';
import { useAuth } from '../../context/AuthContext';
import { useOSStore } from '../store/useOSStore';
import {
  FiShield, FiAlertTriangle, FiActivity, FiSearch, FiArrowLeft,
  FiChevronRight, FiCheckCircle, FiTarget, FiSlash, FiUsers, FiFileText, FiList,
} from 'react-icons/fi';
import AnimatedList from '../../components/AnimatedList';

interface IntegrityAppProps {
  testId?: string;
  testTitle?: string;
}

function scoreColor(score: number | null) {
  if (score === null || score === undefined) return 'rgba(255,255,255,0.4)';
  if (score >= 90) return '#4ade80';
  if (score >= 70) return '#facc15';
  return '#f87171';
}

function riskLabel(score: number | null) {
  if (score === null) return { label: 'Unscored', color: 'rgba(255,255,255,0.2)' };
  if (score >= 90) return { label: 'Clean', color: '#4ade80' };
  if (score >= 70) return { label: 'Low Risk', color: '#facc15' };
  return { label: 'High Risk', color: '#f87171' };
}

// ── Admin: Integrity Detail for one student attempt ───────────────────────────
function AdminAttemptAudit({ attemptId, testId, studentName }: {
  attemptId: string; testId: string; studentName: string;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Use the admin integrity endpoint which already has all behavioral data
    api.get(`/admin/tests/${testId}/integrity`)
      .then(r => {
        const studentData = (r.data.attempts ?? []).find((a: any) => a.attempt_id === attemptId);
        if (!studentData) { setError('Student audit not found'); return; }
        setData(studentData);
      })
      .catch(e => setError(e.response?.data?.error ?? 'Failed to load audit'))
      .finally(() => setLoading(false));
  }, [attemptId, testId]);

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-red-500/10 border-t-red-500 rounded-full animate-spin" />
    </div>
  );
  if (error) return (
    <div className="h-full flex items-center justify-center flex-col gap-3">
      <FiShield className="text-4xl text-white/10" />
      <p className="text-red-400 font-bold text-sm">{error}</p>
    </div>
  );
  if (!data) return null;

  const highFlags   = (data.behavioral_flags ?? []).filter((f: any) => f.severity === 'high');
  const medFlags    = (data.behavioral_flags ?? []).filter((f: any) => f.severity === 'medium');
  const allFlags    = [...highFlags, ...medFlags];
  const details     = data.behavioral_detail ?? [];

  const severityStyle = (sev: string) =>
    sev === 'high'
      ? { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', badge: 'bg-red-500/20 text-red-400' }
      : { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', badge: 'bg-amber-500/20 text-amber-400' };

  function fmtMs(ms: number | null) {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-6 pb-16">

      {/* Hero integrity score */}
      <div className="glass no-shadow p-10 rounded-[3rem] border-white/5 flex items-center gap-10">
        <div className="text-center shrink-0">
          <p className="text-[9px] font-black text-secondary uppercase tracking-[0.4em] opacity-40 mb-2">Integrity Score</p>
          <p className="text-6xl font-black tabular-nums" style={{ color: scoreColor(data.integrity_score) }}>
            {data.integrity_score ?? '—'}
          </p>
          <p className="text-[9px] font-black uppercase tracking-widest mt-2" style={{ color: scoreColor(data.integrity_score) }}>
            {(data.integrity_score ?? 100) >= 90 ? 'CLEAN' : (data.integrity_score ?? 100) >= 70 ? 'LOW RISK' : 'HIGH RISK'}
          </p>
        </div>
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Score', val: `${data.total_score ?? 0}/${data.total_marks ?? 0}`, color: 'rgb(var(--accent))' },
            { label: 'Tab Switches', val: data.tab_switches ?? 0, color: (data.tab_switches ?? 0) >= 3 ? '#f87171' : '#4ade80' },
            { label: 'Focus Lost', val: data.focus_lost_count ?? 0, color: (data.focus_lost_count ?? 0) >= 5 ? '#f87171' : '#4ade80' },
            { label: 'Flags', val: allFlags.length, color: allFlags.length >= 3 ? '#f87171' : allFlags.length >= 1 ? '#facc15' : '#4ade80' },
          ].map((s, i) => (
            <div key={i} className="glass no-shadow p-4 rounded-[1.5rem] border-white/5 text-center">
              <p className="text-[8px] font-black text-secondary uppercase tracking-widest opacity-40 mb-1">{s.label}</p>
              <p className="text-2xl font-black tabular-nums" style={{ color: s.color }}>{s.val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Behavioral flags */}
      {allFlags.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-black text-secondary uppercase tracking-[0.4em] opacity-40 px-2">
            Integrity Flags ({allFlags.length})
          </p>
          {allFlags.map((f: any, i: number) => {
            const st = severityStyle(f.severity);
            return (
              <div key={i} className={`glass no-shadow p-4 flex items-center justify-between rounded-[1.5rem] border-white/5 ${st.bg}`}>
                <div className="flex items-center gap-4">
                  <FiAlertTriangle className={`${st.text} text-lg`} />
                  <div>
                    <p className="text-sm font-black text-primary uppercase tracking-tight">{f.label}</p>
                    <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40 mt-0.5">
                      {f.type?.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${st.badge} ${st.border}`}>
                  {f.severity}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Per-question behavioral details */}
      {details.length > 0 && (
        <div className="space-y-3">
          <p className="text-[9px] font-black text-secondary uppercase tracking-[0.4em] opacity-40 px-2">
            Question-Level Telemetry
          </p>
          {details.map((d: any, i: number) => {
            const hasPaste    = (d.paste_events ?? 0) > 0;
            const fastStart   = (d.time_to_first_keystroke ?? 99999) < 3000;
            const highWpm     = (d.wpm_consistency ?? 0) > 100;
            const noFix       = (d.backspace_count ?? 99) <= 2 && highWpm;
            const longIdle    = (d.idle_periods ?? []).some((p: any) => p.duration > 120);
            const anyFlag     = hasPaste || fastStart || highWpm || noFix || longIdle;

            return (
              <div key={i} className={`glass no-shadow p-5 rounded-[1.5rem] border-white/5 ${anyFlag ? 'bg-red-500/[0.02]' : ''}`}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40">
                    Question {i + 1}
                  </p>
                  {anyFlag && <FiAlertTriangle className="text-red-400 text-sm" />}
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  {[
                    { label: 'First Key', val: fmtMs(d.time_to_first_keystroke), flag: fastStart, icon: '⚡' },
                    { label: 'WPM', val: Math.round(d.wpm_consistency ?? 0), flag: highWpm, icon: '⌨️' },
                    { label: 'Backspaces', val: d.backspace_count ?? 0, flag: noFix, icon: '⌫' },
                    { label: 'Pastes', val: d.paste_events ?? 0, flag: hasPaste, icon: '📋' },
                    { label: 'Edits', val: d.edit_count ?? 0, flag: false, icon: '✏️' },
                    { label: 'Test Runs', val: d.test_runs_before_submit ?? '—', flag: (d.test_runs_before_submit === 0), icon: '▶' },
                  ].map((m, j) => (
                    <div key={j} className={`text-center p-3 rounded-xl ${m.flag ? 'bg-red-500/10' : 'bg-white/3'}`}>
                      <div className="text-base mb-1">{m.icon}</div>
                      <p className={`text-sm font-black tabular-nums ${m.flag ? 'text-red-400' : 'text-primary'}`}>{m.val}</p>
                      <p className="text-[8px] font-black text-secondary uppercase tracking-widest opacity-30 mt-0.5">{m.label}</p>
                    </div>
                  ))}
                </div>
                {(d.idle_periods ?? []).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <p className="text-[8px] font-black text-secondary uppercase tracking-widest opacity-40 mb-2">Idle Periods</p>
                    <div className="flex flex-wrap gap-2">
                      {d.idle_periods.map((p: any, k: number) => (
                        <span key={k} className={`text-[9px] font-black px-3 py-1 rounded-full ${p.duration > 120 ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-secondary '}`}>
                          {fmtMs(p.duration * 1000)} at {p.start}s
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {allFlags.length === 0 && details.length === 0 && (
        <div className="py-20 text-center glass no-shadow border-dashed border-white/5 rounded-[3rem]">
          <FiCheckCircle className="mx-auto text-4xl text-green-500/20 mb-4" />
          <p className="text-[10px] font-black text-secondary uppercase tracking-[0.4em] opacity-40">
            No behavioral anomalies detected for this session
          </p>
        </div>
      )}
    </div>
  );
}

// ── Similarity flags panel ─────────────────────────────────────────────────────
function SimilarityFlagsPanel({ testId }: { testId: string }) {
  const [flags, setFlags]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string>('');

  const loadFlags = () => {
    setLoading(true);
    api.get(`/admin/tests/${testId}/similarity-flags`)
      .then(r => setFlags(r.data.flags ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadFlags(); }, [testId]);

  async function runSimilarity() {
    setRunning(true); setRunResult('');
    try {
      const r = await api.post(`/admin/tests/${testId}/run-similarity`);
      setRunResult(`${r.data.flags_raised} new flag(s) raised from ${r.data.pairs_analyzed} pairs`);
      loadFlags();
    } catch (e: any) {
      setRunResult(e.response?.data?.error ?? 'Similarity check failed');
    } finally { setRunning(false); }
  }

  async function setVerdict(flagId: string, verdict: 'confirmed' | 'dismissed') {
    try {
      await api.patch(`/admin/flags/${flagId}/verdict`, { verdict });
      setFlags(prev => prev.map(f => f.id === flagId ? { ...f, admin_verdict: verdict, reviewed: true } : f));
    } catch (e: any) { alert(e.response?.data?.error ?? 'Failed to update verdict'); }
  }

  return (
    <div className="p-8 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-black text-secondary uppercase tracking-[0.4em] opacity-40">
          Code Similarity Flags
        </p>
        <button
          onClick={runSimilarity}
          disabled={running}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-40"
        >
          {running ? <span className="w-3 h-3 border-2 border-red-400/40 border-t-red-400 rounded-full animate-spin" /> : '🔍'}
          {running ? 'Analyzing...' : 'Run Similarity Check'}
        </button>
      </div>
      {runResult && (
        <p className="text-[10px] font-black text-secondary uppercase tracking-widest px-4 py-2 bg-white/5 rounded-xl border border-white/10">
          {runResult}
        </p>
      )}
      {loading ? (
        <div className="h-32 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-red-500/10 border-t-red-500 rounded-full animate-spin" />
        </div>
      ) : flags.length === 0 ? (
        <div className="py-16 text-center glass no-shadow border-dashed border-white/5 rounded-[2.5rem]">
          <FiShield className="mx-auto text-3xl text-white/10 mb-3" />
          <p className="text-[10px] font-black text-white/20 tracking-[0.4em] uppercase">No similarity flags on this test</p>
          <p className="text-[9px] text-white/10 mt-1 font-bold tracking-widest uppercase">Run the check above to analyze submissions</p>
        </div>
      ) : (
        <div className="space-y-3">
          {flags.map((f: any) => {
            const pct = Math.round(f.similarity_score * 100);
            const verdict = f.admin_verdict;
            return (
              <div key={f.id} className={`glass no-shadow p-5 rounded-[1.5rem] border-white/5 ${verdict === 'confirmed' ? 'bg-red-500/5' : verdict === 'dismissed' ? 'opacity-40' : ''}`}>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40 mb-1">
                      {f.question_statement || 'Debugging Question'}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-primary uppercase tracking-tight">{f.student1}</span>
                      <span className="text-[10px] font-black text-secondary opacity-30">↔</span>
                      <span className="text-sm font-black text-primary uppercase tracking-tight">{f.student2}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-black tabular-nums" style={{ color: pct >= 90 ? '#f87171' : pct >= 80 ? '#facc15' : '#4ade80' }}>
                      {pct}%
                    </p>
                    <p className="text-[8px] font-black uppercase tracking-widest text-secondary opacity-30">Similarity</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {verdict === 'pending' || !verdict ? (
                    <>
                      <button onClick={() => setVerdict(f.id, 'confirmed')}
                        className="px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all">
                        ⚠ Confirm Cheating
                      </button>
                      <button onClick={() => setVerdict(f.id, 'dismissed')}
                        className="px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-white/5 text-secondary border border-white/10 hover:bg-white/10 transition-all">
                        Dismiss
                      </button>
                    </>
                  ) : (
                    <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                      verdict === 'confirmed' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-white/5 text-secondary border-white/10'
                    }`}>
                      {verdict === 'confirmed' ? '⚠ Confirmed' : '✓ Dismissed'}
                    </span>
                  )}
                  <span className="text-[8px] font-black text-secondary uppercase tracking-widest opacity-30 ml-auto">
                    {f.flagged_at ? new Date(f.flagged_at).toLocaleDateString() : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Admin Student List for a test ────────────────────────────────────────────
function AdminStudentList({ testId, testTitle, onSelectStudent }: {
  testId: string; testTitle: string;
  onSelectStudent: (attemptId: string, studentName: string, integrityScore: number | null) => void;
}) {
  const [students, setStudents] = useState<any[]>([]);
  const [summary, setSummary]   = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [sort, setSort]         = useState<'integrity_asc' | 'integrity_desc' | 'name' | 'flags'>('integrity_asc');
  const [tab, setTab]           = useState<'students' | 'similarity'>('students');

  useEffect(() => {
    api.get(`/admin/tests/${testId}/integrity`)
      .then(r => { setStudents(r.data.attempts ?? []); setSummary(r.data.summary); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [testId]);

  const sorted = useMemo(() => {
    const filtered = students.filter(s => s.student_name?.toLowerCase().includes(search.toLowerCase()));
    return [...filtered].sort((a, b) => {
      if (sort === 'integrity_asc') return (a.integrity_score ?? 101) - (b.integrity_score ?? 101);
      if (sort === 'integrity_desc') return (b.integrity_score ?? -1) - (a.integrity_score ?? -1);
      if (sort === 'flags') return (b.behavioral_flags?.length ?? 0) - (a.behavioral_flags?.length ?? 0);
      return (a.student_name ?? '').localeCompare(b.student_name ?? '');
    });
  }, [students, search, sort]);

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-6">

      {/* Summary bar */}
      {summary && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Submissions', val: summary.total },
            { label: 'Avg Integrity', val: `${summary.avg_integrity}%`, color: scoreColor(summary.avg_integrity) },
            { label: 'High Risk', val: summary.high_risk, color: summary.high_risk > 0 ? '#f87171' : '#4ade80' },
            { label: 'Sim Flags', val: summary.similarity_flags, color: summary.similarity_flags > 0 ? '#facc15' : '#4ade80' },
          ].map((s, i) => (
            <div key={i} className="glass no-shadow p-4 rounded-[1.5rem] border-white/5 text-center">
              <p className="text-[8px] font-black text-secondary uppercase tracking-widest opacity-40 mb-1">{s.label}</p>
              <p className="text-xl font-black tabular-nums" style={{ color: (s as any).color ?? 'rgb(var(--accent))' }}>{s.val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab + controls */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1 p-1 bg-white/5 rounded-2xl border border-white/5">
          {(['students', 'similarity'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${tab === t ? 'bg-white/10 text-primary' : 'text-secondary opacity-40 hover:opacity-70'}`}>
              {t === 'students' ? '👥 Students' : '🔗 Similarity'}
            </button>
          ))}
        </div>
        {tab === 'students' && (
          <>
            <div className="relative flex-1 max-w-xs">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search students..."
                className="w-full pl-11 pr-4 py-2.5 bg-black/10 border border-white/10 rounded-2xl text-sm text-primary focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all placeholder:text-white/10 font-bold" />
            </div>
            <select value={sort} onChange={e => setSort(e.target.value as any)}
              className="px-4 py-2.5 bg-black/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-secondary focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all appearance-none">
              <option value="integrity_asc">⬆ Integrity ↑ Risk First</option>
              <option value="integrity_desc">⬇ Integrity ↓ Clean First</option>
              <option value="flags">🚩 Most Flags First</option>
              <option value="name">A–Z Name</option>
            </select>
          </>
        )}
      </div>

      {tab === 'similarity' ? (
        <SimilarityFlagsPanel testId={testId} />
      ) : loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-red-500/10 border-t-red-500 rounded-full animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="py-20 text-center glass no-shadow border-dashed border-white/10 rounded-[2.5rem]">
          <FiUsers className="mx-auto text-4xl text-white/10 mb-4" />
          <p className="text-[10px] font-black text-white/20 tracking-[0.4em] uppercase">No submissions yet</p>
        </div>
      ) : (
        <AnimatedList items={sorted} className="flex flex-col gap-3" renderItem={(s) => {
          const risk     = riskLabel(s.integrity_score);
          const highFlags = (s.behavioral_flags ?? []).filter((f: any) => f.severity === 'high').length;
          const medFlags  = (s.behavioral_flags ?? []).filter((f: any) => f.severity === 'medium').length;
          const hasSim    = (s.similarity_flag_count ?? 0) > 0;
          return (
            <div
              onClick={() => onSelectStudent(s.attempt_id, s.student_name, s.integrity_score)}
              className={`group glass no-shadow p-5 flex items-center gap-5 rounded-[1.5rem] border-white/5 hover:bg-white/[0.08] cursor-pointer transition-all ${
                (s.integrity_score ?? 100) < 60 ? 'hover:border-red-500/30' : 'hover:border-indigo-500/20'
              }`}
            >
              {/* Avatar with risk glow */}
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black shrink-0 ${
                (s.integrity_score ?? 100) < 60 ? 'bg-red-500/10 text-red-400' : 
                (s.integrity_score ?? 100) < 80 ? 'bg-amber-500/10 text-amber-400' :
                'bg-green-500/10 text-green-400'
              }`}>
                {s.student_name?.[0] ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-black text-primary uppercase tracking-tight">{s.student_name}</p>
                  <span className="text-[8px] font-black opacity-30 text-secondary uppercase tracking-widest">{s.year} · {s.division}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {highFlags > 0 && (
                    <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/20 uppercase tracking-widest">
                      🔴 {highFlags} high
                    </span>
                  )}
                  {medFlags > 0 && (
                    <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/20 uppercase tracking-widest">
                      🟡 {medFlags} medium
                    </span>
                  )}
                  {hasSim && (
                    <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/20 uppercase tracking-widest">
                      🔗 Similarity
                    </span>
                  )}
                  {highFlags === 0 && medFlags === 0 && !hasSim && (
                    <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 uppercase tracking-widest">✓ Clean</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0 mr-2">
                <p className="text-xl font-black tabular-nums" style={{ color: scoreColor(s.integrity_score) }}>
                  {s.integrity_score ?? '—'}
                </p>
                <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: risk.color }}>{risk.label}</p>
              </div>
              <FiChevronRight className="text-secondary opacity-20 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />
            </div>
          );
        }} />
      )}
    </div>
  );
}

// ── Student integrity audit view (own attempt) ───────────────────────────────
function StudentAuditView({ testId }: { testId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/attempts/test/${testId}/integrity/me`)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error ?? 'No audit data for this session'))
      .finally(() => setLoading(false));
  }, [testId]);

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-red-500/10 border-t-red-500 rounded-full animate-spin" />
    </div>
  );
  if (error) return (
    <div className="h-full flex items-center justify-center flex-col gap-3 p-8">
      <FiShield className="text-5xl text-red-500/20" />
      <p className="text-red-400 font-black text-sm uppercase tracking-widest text-center">{error}</p>
      <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest">You may not have attempted this session</p>
    </div>
  );

  return (
    <div className="p-8 space-y-8 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-6">
      {/* Hero Score */}
      <div className="glass no-shadow p-10 rounded-[3rem] border-white/5 flex flex-col items-center text-center relative overflow-hidden group">
        <p className="text-[10px] font-black text-secondary uppercase tracking-[0.5em] opacity-40 mb-4">System Integrity Rating</p>
        <h2 className="text-8xl font-black tracking-tighter tabular-nums" style={{ color: scoreColor(data.integrity_score) }}>
          {Math.round(data.integrity_score ?? 100)}%
        </h2>
        <p className="text-xs font-black text-primary uppercase tracking-widest bg-white/5 px-6 py-2 rounded-full border border-white/5 mt-4">
          Operational Consistency Verified
        </p>
        <FiShield className="absolute -right-10 -bottom-10 text-white/[0.02] text-[20rem] group-hover:scale-110 transition-transform duration-1000" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Tab Switches', value: data.tab_switches ?? 0, color: data.tab_switches > 0 ? '#f87171' : '#4ade80' },
          { label: 'Focus Losses', value: data.focus_lost_count ?? 0, color: data.focus_lost_count > 0 ? '#f87171' : '#4ade80' },
          { label: 'Peer Conflict', value: 'None', color: '#4ade80' },
          { label: 'Session Score', value: `${data.total_score ?? 0}`, color: 'rgb(var(--accent))' },
        ].map((s, i) => (
          <div key={i} className="glass no-shadow p-6 rounded-[2rem] border-white/5">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-secondary opacity-40 mb-2">{s.label}</p>
            <p className="text-3xl font-black tracking-tighter tabular-nums" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Behavioral flags */}
      <div className="space-y-3 pb-12">
        <p className="text-[9px] font-black text-secondary uppercase tracking-[0.4em] opacity-40 px-2">Audit Trail</p>
        {data.behavioral_flags?.length > 0 ? (
          data.behavioral_flags.map((f: any, i: number) => (
            <div key={i} className="glass no-shadow p-5 flex items-center justify-between rounded-[1.5rem] border-white/5 bg-red-500/[0.02]">
              <div className="flex items-center gap-5">
                <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-400">
                  <FiAlertTriangle />
                </div>
                <div>
                  <p className="text-sm font-black text-primary uppercase tracking-tight">{f.label}</p>
                  <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40 mt-0.5">Automated Behavioral Flag</p>
                </div>
              </div>
              <span className="text-[10px] font-black text-red-500 uppercase tracking-widest px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
                Flagged
              </span>
            </div>
          ))
        ) : (
          <div className="py-16 text-center glass no-shadow bg-green-500/[0.01] border-dashed border-white/5 rounded-[3rem]">
            <FiCheckCircle className="mx-auto text-4xl text-green-500/20 mb-4" />
            <p className="text-[10px] font-black text-secondary uppercase tracking-[0.4em] opacity-40">No behavioral deviations detected</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function IntegrityApp({ testId: propTestId, testTitle: propTestTitle }: IntegrityAppProps) {
  const { user } = useAuth();
  const { openWindow } = useOSStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'master_admin';

  // Views:
  // Student: discovery (list) → audit
  // Admin:   tests (list) → students (list) → audit (admin version)
  type View = 'discovery' | 'audit' | 'tests' | 'students' | 'admin-audit';

  const [view, setView] = useState<View>(() => {
    if (propTestId && !isAdmin) return 'audit';
    if (isAdmin) return 'tests';
    return 'discovery';
  });

  // Student state
  const [history, setHistory] = useState<any[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(propTestId || null);

  // Admin state
  const [adminTests, setAdminTests] = useState<any[]>([]);
  const [testsLoading, setTestsLoading] = useState(false);
  const [selectedAdminTest, setSelectedAdminTest] = useState<{ id: string; title: string } | null>(
    propTestId ? { id: propTestId, title: propTestTitle ?? '' } : null
  );
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState<string | null>(null);

  const [search, setSearch] = useState('');

  // Load student history
  useEffect(() => {
    if (!isAdmin && view === 'discovery') {
      setHistLoading(true);
      api.get('/attempts/my')
        .then(r => setHistory(r.data.attempts ?? []))
        .catch(console.error)
        .finally(() => setHistLoading(false));
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
    history.filter(h => (h.test_title ?? '').toLowerCase().includes(search.toLowerCase())),
    [history, search]
  );

  const filteredTests = useMemo(() =>
    adminTests.filter(t => (t.title ?? '').toLowerCase().includes(search.toLowerCase())),
    [adminTests, search]
  );

  const handleBack = () => {
    if (view === 'audit') { setView('discovery'); setSelectedTestId(null); }
    else if (view === 'students') { setView('tests'); setSelectedAdminTest(null); }
    else if (view === 'admin-audit') { setView('students'); setSelectedAttemptId(null); }
    else if (view === 'discovery') { openWindow('tests'); } // student only
    // Admin at 'tests' view: already at top level, back is a no-op
  };

  const headerTitle = () => {
    if (view === 'tests') return 'Integrity Registry';
    if (view === 'students') return selectedAdminTest?.title ?? 'Student Audits';
    if (view === 'admin-audit') return `Audit — ${selectedStudentName ?? ''}`;
    if (view === 'audit') return 'Focus Integrity Audit';
    return 'Integrity Registry';
  };

  const headerSub = () => {
    if (view === 'tests') return isAdmin ? 'Select a test to audit student behavioral data' : 'Review behavioral status of historical trials';
    if (view === 'students') return 'Select a student to view their full integrity audit';
    if (view === 'admin-audit') return selectedAdminTest?.title ?? '';
    if (view === 'audit') return 'Your transparency report';
    return '';
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
            <FiShield className="text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]" />
            {headerTitle()}
          </h1>
          <p className="text-[10px] font-black uppercase text-secondary tracking-widest mt-0.5 opacity-40">{headerSub()}</p>
        </div>
        {(view === 'discovery' || view === 'tests') && (
          <div className="relative w-64">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
            <input
              type="text" placeholder={view === 'tests' ? 'Search tests...' : 'Search audits...'} value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-black/10 border border-white/10 rounded-2xl text-sm text-primary focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all placeholder:text-white/10 font-bold"
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
                <div className="w-10 h-10 border-4 border-red-500/10 border-t-red-500 rounded-full animate-spin" />
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
                    onClick={() => { setSelectedAdminTest({ id: t.id, title: t.title }); setSearch(''); setView('students'); }}
                    className="group glass no-shadow p-5 flex items-center gap-5 rounded-[1.5rem] border-white/5 hover:bg-white/[0.08] hover:border-red-500/20 cursor-pointer transition-all"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                      <FiFileText className="text-secondary group-hover:text-red-400 text-xl transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-black text-primary truncate uppercase tracking-tight">{t.title}</h3>
                        <span className="text-[8px] font-black px-2 py-0.5 rounded tracking-widest uppercase shrink-0"
                          style={{ background: `${statusColor}20`, color: statusColor }}>{t.status}</span>
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

        {/* ADMIN: Students list for a test */}
        {isAdmin && view === 'students' && selectedAdminTest && (
          <AdminStudentList
            testId={selectedAdminTest.id}
            testTitle={selectedAdminTest.title}
            onSelectStudent={(aId, name, intScore) => {
              setSelectedAttemptId(aId);
              setSelectedStudentName(name);
              setView('admin-audit');
            }}
          />
        )}

        {/* ADMIN: Individual student audit */}
        {isAdmin && view === 'admin-audit' && selectedAttemptId && selectedAdminTest && (
          <AdminAttemptAudit
            attemptId={selectedAttemptId}
            testId={selectedAdminTest.id}
            studentName={selectedStudentName ?? 'Student'}
          />
        )}

        {/* STUDENT: Discovery list */}
        {!isAdmin && view === 'discovery' && (
          <div className="p-8 max-w-5xl mx-auto">
            {histLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-red-500/10 border-t-red-500 rounded-full animate-spin" />
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="py-20 text-center glass no-shadow border-dashed border-white/10 rounded-[2.5rem]">
                <FiShield className="mx-auto text-4xl text-white/10 mb-4" />
                <p className="text-[10px] font-black text-white/20 tracking-[0.4em] uppercase">No concluded trials found</p>
              </div>
            ) : (
              <AnimatedList items={filteredHistory} className="flex flex-col gap-3" renderItem={(h) => {
                const isAbsent = h.status === 'absent';
                return (
                  <div
                    onClick={() => { if (!isAbsent) { setSelectedTestId(h.test_id); setView('audit'); } }}
                    className={`group glass no-shadow p-5 flex items-center gap-6 transition-all border-white/5 rounded-[1.5rem] ${
                      isAbsent ? 'cursor-not-allowed opacity-50' : 'hover:bg-white/[0.08] hover:border-red-500/20 cursor-pointer'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                      {isAbsent ? <FiSlash className="text-red-400 opacity-60" /> : <FiActivity className="text-secondary group-hover:text-red-400 text-xl" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-black text-primary truncate uppercase tracking-tight">{h.test_title}</h3>
                        {isAbsent && <span className="text-[8px] font-black bg-red-500/20 text-red-400 px-2 py-0.5 rounded tracking-widest uppercase shrink-0">Absent</span>}
                      </div>
                      <p className="text-[9px] text-secondary font-black uppercase tracking-widest opacity-40 mt-1">
                        {isAbsent ? 'No behavioral data' : `Behavioral Snapshot · ${h.status}`}
                      </p>
                    </div>
                    {!isAbsent && <FiChevronRight className="text-secondary opacity-20 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />}
                  </div>
                );
              }} />
            )}
          </div>
        )}

        {/* STUDENT: Audit view */}
        {!isAdmin && view === 'audit' && selectedTestId && (
          <StudentAuditView testId={selectedTestId} />
        )}

      </div>
    </div>
  );
}
