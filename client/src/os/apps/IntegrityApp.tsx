import { useEffect, useState, useMemo } from 'react';
import api from '../../lib/axios';
import { useAuth } from '../../context/AuthContext';
import { useOSStore } from '../store/useOSStore';
import {
  FiShield, FiAlertTriangle, FiActivity, FiSearch, FiArrowLeft,
  FiChevronRight, FiCheckCircle, FiSlash, FiUsers, FiList, FiPlay, FiLayers, FiCpu, FiClock
} from 'react-icons/fi';
import OrbitalBuffer from '../components/OrbitalBuffer';
import AnimatedList from '../../components/AnimatedList';
import GlassSelect from '../../components/admin/GlassSelect';

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
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [auditLoading, setAuditLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<{
    suspicion_score: number;
    narrative: string;
    primary_flag: string;
  } | null>(null);

  useEffect(() => {
    Promise.all([
      api.get(`/admin/tests/${testId}/integrity`),
      api.get(`/admin/tests/${testId}/questions-meta`).catch(() => ({ data: { questions: [] } })),
    ]).then(([intRes, qRes]) => {
      const studentData = (intRes.data.attempts ?? []).find((a: any) => a.id === attemptId || a.attempt_id === attemptId);
      if (!studentData) { setError('Student audit not found'); return; }
      setData(studentData);
      setQuestions(qRes.data.questions ?? []);
    })
      .catch(e => setError(e.response?.data?.error ?? 'Failed to load audit'))
      .finally(() => setLoading(false));
  }, [attemptId, testId]);

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <OrbitalBuffer size={40} className="text-accent" />
    </div>
  );
  if (error) return (
    <div className="h-full flex items-center justify-center flex-col gap-3">
      <FiShield className="text-4xl text-white/10" />
      <p className="text-red-400 font-bold text-sm uppercase tracking-widest">{error}</p>
    </div>
  );
  if (!data) return null;

  const highFlags = (data.behavioral_flags ?? []).filter((f: any) => f.severity === 'high');
  const medFlags = (data.behavioral_flags ?? []).filter((f: any) => f.severity === 'medium');
  const allFlags = [...highFlags, ...medFlags];
  const details = data.behavioral_detail ?? [];

  const severityStyle = (sev: string) =>
    sev === 'high'
      ? { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', badge: 'bg-red-500/20 text-red-400' }
      : { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', badge: 'bg-amber-500/20 text-amber-400' };

  function fmtMs(ms: number | null) {
    if (ms === null || ms === undefined) return '—';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  function MetricCell({ label, val, flag, icon, na }: { label: string; val: any; flag?: boolean; icon: any; na?: boolean }) {
    return (
      <div className={`text-center p-4 rounded-2xl border border-white/5 transition-all ${na ? 'bg-white/[0.01] opacity-40' : flag ? 'bg-red-500/10 border-red-500/20' : 'bg-white/[0.01]'}`}>
        <div className="flex justify-center mb-1 text-secondary opacity-40 text-sm">{icon}</div>
        <p className={`text-sm font-black tabular-nums ${na ? 'text-secondary' : flag ? 'text-red-400' : 'text-primary'}`}>
          {na ? 'N/A' : val}
        </p>
        <p className="text-[8px] font-black text-secondary uppercase tracking-widest opacity-30 mt-1">{label}</p>
      </div>
    );
  }

  const codingDetails = details.filter((d: any) => d.question_type === 'debugging' || d.question_type === 'coding' || (!d.question_type && d.test_runs_before_submit !== undefined));
  const mcqDetails = details.filter((d: any) => d.question_type === 'mcq_single' || d.question_type === 'mcq_multi');

  const runAiAudit = async () => {
    setAuditLoading(true);
    try {
      const res = await api.post(`/admin/attempts/${attemptId}/audit`);
      setAuditResult(res.data);
    } catch (e) {
      alert('AI Audit failed. Ensure local Ollama is running.');
    } finally {
      setAuditLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-6 pb-24">

      {/* Forensic Audit Panel */}
      <div className={`p-8 rounded-[3rem] border transition-all duration-700 ${auditResult ? 'border-red-500/20 bg-red-500/[0.02]' : 'glass-2'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-2xl ${auditResult ? 'bg-red-500/10' : 'bg-white/5'}`}>
              <FiCpu className={`text-2xl ${auditResult ? 'text-red-500' : 'text-secondary opacity-40'}`} />
            </div>
            <div className="flex flex-col">
              <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                Cognitive Forensic Audit
                {auditResult && <span className="text-[9px] text-red-500 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">VERIFIED ATTEMPT</span>}
              </h3>
              <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-30 mt-1">Local Processing Node Active</p>
            </div>
          </div>
          {!auditResult && (
            <button onClick={runAiAudit} disabled={auditLoading}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all border border-white/10 active:scale-95">
              {auditLoading ? 'Processing Telemetry...' : 'Execute AI Audit'}
            </button>
          )}
        </div>

        {auditResult && (
          <div className="mt-8 pt-8 border-t border-white/5 space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="grid grid-cols-4 gap-6">
              <div className="col-span-1 glass-2 p-6 rounded-3xl border-white/5 bg-white/[0.01]">
                <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40 mb-2">Confidence Score</p>
                <p className={`text-4xl font-black tabular-nums ${auditResult.suspicion_score > 60 ? 'text-red-500' : 'text-amber-500'}`}>
                  {auditResult.suspicion_score}%
                </p>
              </div>
              <div className="col-span-3 glass-2 p-6 rounded-3xl border-white/5 bg-white/[0.01]">
                <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40 mb-2">Observations</p>
                <p className="text-sm text-primary/80 font-bold leading-relaxed">
                  {auditResult.narrative}
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-[9px] font-black text-red-500 uppercase tracking-widest px-3 py-1 bg-red-500/10 rounded-full border border-red-500/20">
                    Primary Flag: {auditResult.primary_flag}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hero integrity score */}
      <div className="glass-2 p-12 rounded-[4rem] border-white/5 flex items-center gap-12 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-[100px] rounded-full -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-1000" />

        <div className="text-center shrink-0 relative z-10">
          <p className="text-[10px] font-black text-secondary uppercase tracking-[0.4em] opacity-40 mb-3">Integrity Coefficient</p>
          <div className="text-8xl font-black tabular-nums tracking-tighter" style={{ color: scoreColor(data.integrity_score) }}>
            {data.integrity_score ?? '—'}
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-3" style={{ color: scoreColor(data.integrity_score) }}>
            {(data.integrity_score ?? 100) >= 90 ? 'High Confidence' : (data.integrity_score ?? 100) >= 70 ? 'Moderate Consistency' : 'Significant Deviation'}
          </p>
        </div>

        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
          {[
            { label: 'Evaluation Score', val: `${data.total_score ?? 0}/${data.total_marks ?? 0}`, color: 'rgb(var(--accent))' },
            { label: 'Tab Switches', val: data.tab_switches ?? 0, color: (data.tab_switches ?? 0) >= 3 ? '#f87171' : '#4ade80' },
            { label: 'Focus Loss', val: data.focus_lost_count ?? 0, color: (data.focus_lost_count ?? 0) >= 5 ? '#f87171' : '#4ade80' },
            { label: 'Audit Flags', val: allFlags.length, color: allFlags.length >= 3 ? '#f87171' : allFlags.length >= 1 ? '#facc15' : '#4ade80' },
          ].map((s, i) => (
            <div key={i} className="glass-2 p-6 rounded-[2rem] border-white/5 text-center bg-white/[0.01]">
              <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40 mb-2">{s.label}</p>
              <p className="text-3xl font-black tabular-nums" style={{ color: s.color }}>{s.val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Behavioral flags */}
      {allFlags.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-black text-secondary uppercase tracking-[0.4em] opacity-40 px-6">
            Structural Anomaly Detection ({allFlags.length})
          </p>
          <div className="flex flex-col gap-4">
            {allFlags.map((f: any, i: number) => {
              const st = severityStyle(f.severity);
              return (
                <div key={i} className={`glass-2 p-6 flex items-center justify-between rounded-[2.5rem] border-white/5 ${st.bg}`}>
                  <div className="flex items-center gap-6">
                    <div className={`p-4 rounded-2xl ${st.bg} border ${st.border}`}>
                      <FiAlertTriangle className={`${st.text} text-xl`} />
                    </div>
                    <div>
                      <p className="text-base font-black text-primary uppercase tracking-wider">{f.label}</p>
                      <p className="text-[10px] font-black text-secondary uppercase tracking-widest opacity-40 mt-1">
                        Category: {f.type?.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-5 py-2 rounded-xl border ${st.badge} ${st.border}`}>
                    {f.severity} severity
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── CODING / DEBUGGING ANALYSIS ── */}
      {codingDetails.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 px-6">
            <FiActivity className="text-2xl text-accent opacity-40" />
            <p className="text-[10px] font-black text-secondary uppercase tracking-[0.4em] opacity-60">
              Logic Decomposition Analysis ({codingDetails.length} items)
            </p>
            <div className="h-px flex-1 bg-white/5" />
            <span className="text-[8px] font-black px-3 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/20 tracking-tighter">
              CRITICAL FORENSIC LAYER
            </span>
          </div>
          {codingDetails.map((d: any, i: number) => {
            const attempted = d.time_to_first_keystroke !== null || (d.backspace_count ?? 0) > 0 || (d.edit_count ?? 0) > 0;
            const hasPaste = (d.paste_events ?? 0) > 0;
            const fastStart = attempted && (d.time_to_first_keystroke ?? 99999) < 3000;
            const highWpm = (d.wpm_consistency ?? 0) > 100;
            const noFix = attempted && (d.backspace_count ?? 99) <= 2 && highWpm;
            const noRuns = attempted && (d.test_runs_before_submit ?? 1) === 0;
            const longIdle = (d.idle_periods ?? []).some((p: any) => (p.duration_seconds ?? p.duration ?? 0) > 180);
            const flagCount = [hasPaste, fastStart, highWpm, noFix, noRuns, longIdle].filter(Boolean).length;

            return (
              <div key={i} className={`glass-2 rounded-[3.5rem] border overflow-hidden transition-all ${!attempted ? 'border-white/5 opacity-50' : flagCount >= 2 ? 'border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.05)]' : flagCount >= 1 ? 'border-amber-500/20' : 'border-green-500/20'}`}>
                {/* Question header */}
                <div className={`px-8 py-5 flex items-center justify-between border-b border-white/5 ${!attempted ? 'bg-white/[0.01]' : flagCount >= 2 ? 'bg-red-500/[0.03]' : flagCount >= 1 ? 'bg-amber-500/[0.02]' : 'bg-green-500/[0.02]'}`}>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-xl bg-white/5 border border-white/5 text-secondary">
                      Item #{i + 1}
                    </span>
                    {!attempted && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-secondary opacity-30">NOT ATTEMPTED</span>
                    )}
                    {flagCount > 0 && attempted && (
                      <div className={`flex gap-2`}>
                        {hasPaste && <span className="text-[9px] font-black uppercase bg-red-500/20 text-red-400 px-3 py-1 rounded-full border border-red-500/20">PASTE DETECTED</span>}
                        {fastStart && <span className="text-[9px] font-black uppercase bg-red-500/20 text-red-400 px-3 py-1 rounded-full border border-red-500/20">PRE-PREPARED</span>}
                        {flagCount > 2 && <span className="text-[9px] font-black uppercase bg-red-500/20 text-red-500 px-3 py-1 rounded-full border border-red-500/40 animate-pulse">HIGH SUSPICION</span>}
                      </div>
                    )}
                  </div>
                  {attempted && flagCount === 0 && <span className="text-[10px] font-black text-green-400 uppercase tracking-widest flex items-center gap-2"><FiCheckCircle /> AUTHENTIC INPUT</span>}
                </div>

                {/* Metrics grid */}
                <div className="p-8">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    <MetricCell label="Time to Start" val={fmtMs(d.time_to_first_keystroke)} flag={fastStart} icon={<FiActivity />} na={!attempted} />
                    <MetricCell label="Typing Speed" val={`${Math.round(d.wpm_consistency ?? 0)} WPM`} flag={highWpm} icon={<FiList />} na={!attempted} />
                    <MetricCell label="Corrections" val={d.backspace_count ?? 0} flag={noFix} icon={<FiSlash />} na={!attempted} />
                    <MetricCell label="Paste Events" val={d.paste_events ?? 0} flag={hasPaste} icon={<FiLayers />} na={!attempted} />
                    <MetricCell label="logic Edits" val={d.edit_count ?? 0} icon={<FiSearch />} na={!attempted} />
                    <MetricCell label="Unit test Runs" val={d.test_runs_before_submit ?? '—'} flag={noRuns} icon={<FiPlay />} na={!attempted} />
                  </div>

                  {/* Flag narrative */}
                  {attempted && flagCount > 0 && (
                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { cond: hasPaste, label: 'UNAUTHORIZED BUFFER ACCESS', desc: 'Internal clipboard events detected during editor focus.' },
                        { cond: fastStart, label: 'LOW DELTA INITIALIZATION', desc: 'Complex logic input initialized within 3s of item opening.' },
                        { cond: highWpm, label: 'ANOMALOUS INPUT VELOCITY', desc: 'WPM exceeds natural human typing limits (>120 WPM).' },
                        { cond: noFix, label: 'MECHANICAL CONSISTENCY', desc: 'High velocity input with zero correction cycles detected.' },
                      ].filter(x => x.cond).map((x, j) => (
                        <div key={j} className="p-4 rounded-2xl bg-red-500/[0.03] border border-red-500/10 flex items-start gap-4">
                          <span className="text-xl mt-1">🚨</span>
                          <div>
                            <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">{x.label}</p>
                            <p className="text-[11px] font-bold text-primary/60 mt-0.5">{x.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Idle periods */}
                  {attempted && (d.idle_periods ?? []).length > 0 && (
                    <div className="mt-8 pt-8 border-t border-white/5">
                      <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40 mb-3 flex items-center gap-2"><FiClock /> Temporal Gaps</p>
                      <div className="flex flex-wrap gap-2">
                        {d.idle_periods.map((p: any, k: number) => {
                          const dur = p.duration_seconds ?? p.duration ?? 0;
                          return (
                            <div key={k} className={`flex flex-col px-5 py-3 rounded-2xl border transition-all ${dur > 180 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-white/5 border-white/5 text-secondary opacity-60'}`}>
                              <span className="text-sm font-black tabular-nums">{dur >= 60 ? `${Math.round(dur / 60)}m` : `${dur}s`}</span>
                              <span className="text-[8px] font-black uppercase tracking-widest opacity-40">System Idle</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MCQ analysis */}
      {mcqDetails.length > 0 && (
        <div className="space-y-4">
          <p className="text-[10px] font-black text-secondary uppercase tracking-[0.4em] opacity-40 px-6">
            Response Telemetry — Structural Items ({mcqDetails.length})
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mcqDetails.map((d: any, i: number) => {
              const attempted = d.time_to_first_keystroke !== null || (d.edit_count ?? 0) > 0;
              const fastClick = attempted && (d.time_to_first_keystroke ?? 99999) < 2000;
              return (
                <div key={i} className={`glass-2 p-8 rounded-[3rem] border-white/5 transition-all ${!attempted ? 'opacity-40' : ''}`}>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-[10px] font-black uppercase tracking-widest text-secondary opacity-40">Item #{i + 1} (MCQ)</span>
                    {fastClick && <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">IMPULSIVE DECISION</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <MetricCell label="Reaction" val={fmtMs(d.time_to_first_keystroke)} flag={fastClick} icon={<FiActivity />} na={!attempted} />
                    <MetricCell label="Revisions" val={d.edit_count ?? 0} icon={<FiSearch />} na={!attempted} />
                    <MetricCell label="Exposure" val={d.time_spent_seconds ? `${d.time_spent_seconds}s` : '—'} icon={<FiClock />} na={!attempted} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {allFlags.length === 0 && details.length === 0 && (
        <div className="py-24 text-center glass-2 border-dashed border-white/10 rounded-[4rem]">
          <FiCheckCircle className="mx-auto text-5xl text-green-500/10 mb-6" />
          <p className="text-[12px] font-black text-secondary uppercase tracking-[0.5em] opacity-40">
            Perimeter Secure: Zero behavioral anomalies identified
          </p>
        </div>
      )}
    </div>
  );
}

// ── Similarity flags panel ─────────────────────────────────────────────────────
function SimilarityFlagsPanel({ testId }: { testId: string }) {
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string>('');
  const [selectedFlag, setSelectedFlag] = useState<any | null>(null);

  const loadFlags = () => {
    setLoading(true);
    api.get(`/admin/tests/${testId}/similarity-flags`)
      .then(r => {
        setFlags(r.data.flags ?? []);
        if (selectedFlag) {
          const updated = (r.data.flags ?? []).find((f: any) => f.id === selectedFlag.id);
          if (updated) setSelectedFlag(updated);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadFlags(); }, [testId]);

  async function runSimilarity() {
    setRunning(true); setRunResult('');
    try {
      const r = await api.post(`/admin/tests/${testId}/run-similarity`);
      setRunResult(`${r.data.flags_raised} new flags raised from ${r.data.pairs_analyzed} logic pairs`);
      loadFlags();
    } catch (e: any) {
      setRunResult(e.response?.data?.error ?? 'Analysis failure');
    } finally { setRunning(false); }
  }

  async function setVerdict(flagId: string, verdict: 'confirmed' | 'dismissed') {
    try {
      await api.patch(`/admin/flags/${flagId}/verdict`, { verdict });
      setFlags(prev => prev.map(f => f.id === flagId ? { ...f, admin_verdict: verdict, reviewed: true } : f));
      if (selectedFlag?.id === flagId) {
        setSelectedFlag((prev: any) => ({ ...prev, admin_verdict: verdict, reviewed: true }));
      }
    } catch (e: any) { alert(e.response?.data?.error ?? 'Verdict synchronization failed'); }
  }

  if (loading) return (
    <div className="h-96 flex items-center justify-center">
      <OrbitalBuffer size={40} className="text-accent" />
    </div>
  );

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black text-secondary uppercase tracking-[0.4em] opacity-40">Forensic Integrity Module</p>
          <h2 className="text-3xl font-black text-primary tracking-tighter uppercase mt-1">Similarity Workbench</h2>
        </div>
        <button onClick={runSimilarity} disabled={running} className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-accent text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-accent/20 hover:opacity-90 active:scale-95 transition-all">
          <FiPlay /> {running ? 'Analyzing Cross-Session Logic...' : 'Execute forensic comparison'}
        </button>
      </div>

      {runResult && (
        <div className="px-6 py-4 glass-2 border-white/10 rounded-2xl animate-in slide-in-from-top-4">
          <p className="text-[10px] font-black text-secondary uppercase tracking-widest">{runResult}</p>
        </div>
      )}

      {flags.length === 0 ? (
        <div className="py-32 text-center glass-2 border-dashed border-white/10 rounded-[4rem]">
          <FiShield className="mx-auto text-5xl text-white/10 mb-6" />
          <p className="text-[12px] font-black text-white/20 tracking-[0.6em] uppercase">Logical Isolation Verified</p>
          <p className="text-[10px] text-white/10 mt-3 font-black tracking-widest uppercase opacity-40">No cross-session logic reproduction identified</p>
        </div>
      ) : (
        <div className={`grid gap-8 transition-all duration-700 ${selectedFlag ? 'grid-cols-12' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
          <div className={`${selectedFlag ? 'col-span-4' : ''} space-y-3 max-h-[800px] overflow-auto pr-4 custom-scrollbar`}>
            {flags.map((f: any) => {
              const pct = Math.round(f.similarity_score * 100);
              const isSelected = selectedFlag?.id === f.id;
              const verdict = f.admin_verdict;
              return (
                <div key={f.id} onClick={() => setSelectedFlag(f)}
                  className={`group relative glass-2 p-6 rounded-[2.5rem] cursor-pointer transition-all border border-white/5 hover:bg-white/[0.05] ${isSelected ? 'border-red-500/40 bg-red-500/[0.03]' : verdict === 'dismissed' ? 'opacity-40 grayscale' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`w-2.5 h-2.5 rounded-full ${pct >= 90 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse' : 'bg-amber-500'}`} />
                        <p className="text-base font-black text-primary truncate tracking-tight uppercase">{f.student1} / {f.student2}</p>
                      </div>
                      <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-30 line-clamp-1">{f.question_statement || 'Logical Signature Match'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black tabular-nums tracking-tighter" style={{ color: pct >= 90 ? '#f87171' : '#facc15' }}>{pct}%</p>
                    </div>
                  </div>
                  {verdict !== 'pending' && verdict && (
                    <div className="mt-4">
                      <span className={`text-[8px] font-black px-3 py-1 rounded-full border ${verdict === 'confirmed' ? 'bg-red-500/20 text-red-500 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'bg-white/5 text-secondary border-white/10'} uppercase tracking-[0.2em]`}>
                        {verdict === 'confirmed' ? '⚠ Security Violation' : '✓ Case Dismissed'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {selectedFlag && (
            <div className="col-span-8 space-y-4 animate-in fade-in slide-in-from-right-8 duration-700">
              <div className="glass-2 rounded-[3.5rem] border-white/5 overflow-hidden flex flex-col h-[800px] shadow-2xl">
                <div className="p-8 border-b border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-3xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                      <span className="text-3xl font-black text-red-500">{Math.round(selectedFlag.similarity_score * 100)}%</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-primary uppercase tracking-tight">Logic Pattern Comparison</h3>
                      <p className="text-[10px] font-black text-secondary uppercase tracking-widest opacity-40 mt-1 truncate max-w-md">{selectedFlag.question_statement}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {(!selectedFlag.admin_verdict || selectedFlag.admin_verdict === 'pending') ? (
                      <>
                        <button onClick={() => setVerdict(selectedFlag.id, 'confirmed')} className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-red-600 text-white shadow-xl shadow-red-500/20 hover:bg-red-500 transition-all active:scale-95">Confirm Breach</button>
                        <button onClick={() => setVerdict(selectedFlag.id, 'dismissed')} className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-primary hover:bg-white/10 transition-all active:scale-95">Dismiss Case</button>
                      </>
                    ) : (
                      <div className={`px-6 py-3 rounded-2xl border flex items-center gap-4 ${selectedFlag.admin_verdict === 'confirmed' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
                        <FiCheckCircle className="text-base" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Case {selectedFlag.admin_verdict}</span>
                        <button onClick={() => setVerdict(selectedFlag.id, 'pending' as any)} className="ml-2 text-[9px] font-black border-b border-current opacity-40 hover:opacity-100 transition-opacity">Reset Review</button>
                      </div>
                    )}
                    <button onClick={() => setSelectedFlag(null)} className="p-3.5 rounded-2xl bg-white/5 text-secondary hover:bg-white/10 transition-all ml-2 border border-white/5">
                      <FiArrowLeft className="text-xl" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-hidden grid grid-cols-2 divide-x divide-white/5">
                  <div className="flex flex-col overflow-hidden group/source">
                    <div className="px-6 py-4 bg-white/[0.01] border-b border-white/5 flex items-center justify-between shrink-0">
                      <p className="text-[10px] font-black text-accent uppercase tracking-[0.2em]">{selectedFlag.student1}</p>
                      <span className="text-[9px] font-black text-secondary opacity-30 uppercase tracking-widest">Subject A · {selectedFlag.language}</span>
                    </div>
                    <pre className="flex-1 p-8 overflow-auto text-xs font-mono text-primary/80 leading-relaxed custom-scrollbar bg-black/5 selection:bg-red-500/30">
                      <code>{selectedFlag.code1 || '// No telemetry payload available'}</code>
                    </pre>
                  </div>
                  <div className="flex flex-col overflow-hidden group/source">
                    <div className="px-6 py-4 bg-white/[0.01] border-b border-white/5 flex items-center justify-between shrink-0">
                      <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">{selectedFlag.student2}</p>
                      <span className="text-[9px] font-black text-secondary opacity-30 uppercase tracking-widest">Subject B · {selectedFlag.language}</span>
                    </div>
                    <pre className="flex-1 p-8 overflow-auto text-xs font-mono text-primary/80 leading-relaxed custom-scrollbar bg-black/5 selection:bg-red-500/30">
                      <code>{selectedFlag.code2 || '// No telemetry payload available'}</code>
                    </pre>
                  </div>
                </div>

                <div className="p-10 bg-red-500/[0.03] border-t border-white/5 flex items-center gap-10 shrink-0">
                  <div className="flex items-center gap-6">
                    <FiActivity className="text-4xl text-red-500/40" />
                    <div>
                      <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.3em] mb-2">Algorithm Match Insight</p>
                      <p className="text-sm font-medium text-white/60 max-w-2xl leading-relaxed">Cross-verification indicates significant logic overlap in the structural syntax and procedural flow between both subjects.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Admin: Student List ──────────────────────────────────────────────────────
function AdminStudentList({ testId, testTitle, onSelectStudent }: {
  testId: string; testTitle: string;
  onSelectStudent: (attemptId: string, studentName: string, integrityScore: number | null) => void;
}) {
  const [students, setStudents] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'integrity_asc' | 'integrity_desc' | 'name' | 'flags'>('integrity_asc');
  const [tab, setTab] = useState<'students' | 'similarity'>('students');

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
    <div className="p-10 space-y-10 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-8">

      {/* Summary Matrix */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Evaluation Payload', val: summary.total, icon: <FiLayers /> },
            { label: 'System Consistency', val: `${summary.avg_integrity}%`, color: scoreColor(summary.avg_integrity), icon: <FiActivity /> },
            { label: 'Terminal Risks', val: summary.high_risk, color: summary.high_risk > 0 ? '#f87171' : '#4ade80', icon: <FiShield /> },
            { label: 'Pattern Flags', val: summary.similarity_flags, color: summary.similarity_flags > 0 ? '#facc15' : '#4ade80', icon: <FiSearch /> },
          ].map((s, i) => (
            <div key={i} className="glass-2 p-8 rounded-[2.5rem] border-white/5 text-center relative overflow-hidden group">
              <div className="absolute -top-4 -right-4 text-4xl text-white/[0.02] group-hover:scale-110 transition-transform duration-700">{s.icon}</div>
              <p className="text-[9px] font-black text-secondary uppercase tracking-[0.3em] opacity-40 mb-3">{s.label}</p>
              <p className="text-4xl font-black tabular-nums tracking-tighter" style={{ color: (s as any).color ?? 'rgb(var(--accent))' }}>{s.val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Controller Hub */}
      <div className="flex items-center gap-6">
        <div className="flex gap-2 p-1.5 glass-2 rounded-[1.5rem] border border-white/10 shrink-0">
          {(['students', 'similarity'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${tab === t ? 'bg-white/10 text-primary shadow-inner' : 'text-secondary opacity-40 hover:opacity-100'}`}>
              {t === 'students' ? 'Subjects' : 'Signatures'}
            </button>
          ))}
        </div>

        {tab === 'students' && (
          <div className="flex-1 flex items-center gap-4">
            <div className="relative flex-1 group">
              <FiSearch className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-accent transition-colors" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Synchronize Subject ID..."
                className="w-full pl-14 pr-6 py-4 glass-2 border border-white/5 rounded-[1.5rem] text-[11px] text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all font-black uppercase tracking-[0.2em] placeholder:text-white/10" />
            </div>
            <GlassSelect
              value={sort}
              onChange={(v) => setSort(v as any)}
              options={[
                { value: 'integrity_asc', label: 'Priority: Terminal Risk' },
                { value: 'integrity_desc', label: 'Priority: High Consistency' },
                { value: 'flags', label: 'Priority: Behavioral Anomaly' },
                { value: 'name', label: 'Registry Index: A–Z' },
              ]}
              className="w-72"
            />
          </div>
        )}
      </div>

      {tab === 'similarity' ? (
        <SimilarityFlagsPanel testId={testId} />
      ) : loading ? (
        <div className="h-96 flex items-center justify-center">
          <OrbitalBuffer size={48} className="text-accent" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="py-32 text-center glass-2 border-dashed border-white/10 rounded-[4rem]">
          <FiUsers className="mx-auto text-5xl text-white/10 mb-6" />
          <p className="text-[12px] font-black text-white/20 tracking-[0.6em] uppercase">Test Registry Empty</p>
        </div>
      ) : (
        <AnimatedList items={sorted} className="grid grid-cols-1" gap={16} renderItem={(s) => {
          const risk = riskLabel(s.integrity_score);
          const highFlags = (s.behavioral_flags ?? []).filter((f: any) => f.severity === 'high').length;
          const medFlags = (s.behavioral_flags ?? []).filter((f: any) => f.severity === 'medium').length;
          const hasSim = (s.similarity_flag_count ?? 0) > 0;
          return (
            <div
              onClick={() => onSelectStudent(s.attempt_id, s.student_name, s.integrity_score)}
              className={`group glass-2 p-8 flex items-center gap-8 rounded-[3rem] border border-white/5 hover:bg-white/[0.08] cursor-pointer transition-all active:scale-[0.98] ${(s.integrity_score ?? 100) < 60 ? 'hover:border-red-500/40 shadow-[0_0_40px_rgba(239,68,68,0.05)]' : 'hover:border-accent/40 lg:hover:shadow-[0_0_50px_rgba(var(--accent-rgb),0.05)]'
                }`}
            >
              <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-xl font-black shrink-0 shadow-2xl border ${(s.integrity_score ?? 100) < 60 ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                  (s.integrity_score ?? 100) < 80 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                    'bg-green-500/10 text-green-500 border-green-500/20'
                }`}>
                {s.student_name?.[0] ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-lg font-black text-primary uppercase tracking-tight truncate group-hover:text-accent transition-colors">{s.student_name}</h4>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {highFlags > 0 && <span className="text-[8px] font-black px-2.5 py-1 bg-red-500/20 text-red-400 border border-red-500/20 rounded-full tracking-widest uppercase">CRITICAL: {highFlags}</span>}
                  {medFlags > 0 && <span className="text-[8px] font-black px-2.5 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-full tracking-widest uppercase">STOCHASTIC: {medFlags}</span>}
                  {hasSim && <span className="text-[8px] font-black px-2.5 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-full tracking-widest uppercase">SIMILARITY PATTERN</span>}
                  {highFlags === 0 && medFlags === 0 && !hasSim && <span className="text-[8px] font-black px-2.5 py-1 bg-green-500/10 text-green-500 rounded-full tracking-widest uppercase">VERIFIED CLEAN</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-3xl font-black tabular-nums tracking-tighter" style={{ color: scoreColor(s.integrity_score) }}>
                  {s.integrity_score ?? '—'}
                </p>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 mt-1" style={{ color: risk.color }}>{risk.label}</p>
              </div>
            </div>
          );
        }} />
      )}
    </div>
  );
}

// ── Student Experience: Own Audit ───────────────────────────────────────────
function StudentAuditView({ testId }: { testId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/attempts/test/${testId}/integrity/me`)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error ?? 'No assessment data synchronization record found'))
      .finally(() => setLoading(false));
  }, [testId]);

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <OrbitalBuffer size={48} className="text-accent" />
    </div>
  );
  if (error) return (
    <div className="h-full flex items-center justify-center flex-col gap-6 p-12 text-center group">
      <div className="w-24 h-24 rounded-[2rem] glass-2 flex items-center justify-center border-white/5 group-hover:scale-110 transition-transform duration-700">
        <FiShield className="text-5xl text-red-500/20" />
      </div>
      <div className="space-y-2">
        <p className="text-primary font-black text-lg uppercase tracking-tight">{error}</p>
        <p className="text-[10px] text-secondary font-black uppercase tracking-[0.3em] opacity-40">No historical telemetry matching this UID found</p>
      </div>
    </div>
  );

  return (
    <div className="p-10 space-y-12 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-10">

      {/* Subject Hero Score */}
      <div className="glass-2 p-16 rounded-[4rem] border-white/5 flex flex-col items-center text-center relative overflow-hidden group shadow-2xl">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-accent/5 blur-[120px] rounded-full group-hover:scale-150 transition-transform duration-1000" />
        <p className="text-[11px] font-black text-secondary uppercase tracking-[0.6em] opacity-40 mb-6 relative z-10">Assessment Consistency Metric</p>
        <h2 className="text-[10rem] font-black tracking-tighter tabular-nums leading-none relative z-10" style={{ color: scoreColor(data.integrity_score) }}>
          {Math.round(data.integrity_score ?? 100)}%
        </h2>
        <div className="mt-8 flex gap-3 relative z-10">
          <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] bg-white/5 px-8 py-3 rounded-full border border-white/10 shadow-inner">
            Operational Integrity Verified
          </span>
          <span className="text-[10px] font-black text-accent uppercase tracking-[0.3em] bg-accent/5 px-8 py-3 rounded-full border border-accent/10">
            {data.integrity_score >= 90 ? 'AUTHENTIC' : 'REVIEWED'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Navigation Switches', value: data.tab_switches ?? 0, color: data.tab_switches > 0 ? '#f87171' : '#4ade80', icon: <FiLayers /> },
          { label: 'Terminal Focus Lost', value: data.focus_lost_count ?? 0, color: data.focus_lost_count > 0 ? '#f87171' : '#4ade80', icon: <FiActivity /> },
          { label: 'Security Conflicts', value: 'Zero', color: '#4ade80', icon: <FiShield /> },
          { label: 'Performance Marks', value: `${data.total_score ?? 0}`, color: 'rgb(var(--accent))', icon: <FiCheckCircle /> },
        ].map((s, i) => (
          <div key={i} className="glass-2 p-8 rounded-[2.5rem] border-white/5 relative group overflow-hidden">
            <div className="absolute -bottom-4 -right-4 text-4xl text-white/[0.02] group-hover:scale-110 transition-transform duration-700">{s.icon}</div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-secondary opacity-40 mb-3">{s.label}</p>
            <p className="text-4xl font-black tracking-tighter tabular-nums" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4 pb-20">
        <p className="text-[10px] font-black text-secondary uppercase tracking-[0.4em] opacity-40 px-6">System Audit Logs</p>
        {data.behavioral_flags?.length > 0 ? (
          data.behavioral_flags.map((f: any, i: number) => (
            <div key={i} className="glass-2 p-8 flex items-center justify-between rounded-[3rem] border border-white/5 bg-red-500/[0.01]">
              <div className="flex items-center gap-8">
                <div className="w-20 h-20 rounded-[2rem] bg-accent/5 flex items-center justify-center text-3xl font-black text-accent shrink-0 border border-accent/10 shadow-inner">
                  {f.label[0]}
                </div>
                <div>
                  <h4 className="text-lg font-black text-primary uppercase tracking-tight">{f.label}</h4>
                  <p className="text-[10px] font-black text-secondary uppercase tracking-widest opacity-40 mt-1">Automated Behavioral Event Sync</p>
                </div>
              </div>
              <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] px-8 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 shadow-xl">
                Anomaly Flagged
              </span>
            </div>
          ))
        ) : (
          <div className="py-24 text-center glass-2 border-dashed border-white/5 rounded-[4rem]">
            <FiCheckCircle className="mx-auto text-5xl text-green-500/10 mb-6" />
            <p className="text-[12px] font-black text-secondary uppercase tracking-[0.6em] opacity-40">Identity & Behavior Fully Synchronized</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Root Application ────────────────────────────────────────────────────────
export default function IntegrityApp({ testId: propTestId, testTitle: propTestTitle }: IntegrityAppProps) {
  const { user } = useAuth();
  const { openWindow } = useOSStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'master_admin';

  type View = 'discovery' | 'audit' | 'tests' | 'students' | 'admin-audit';

  const [view, setView] = useState<View>(() => {
    if (propTestId && !isAdmin) return 'audit';
    if (isAdmin) return 'tests';
    return 'discovery';
  });

  const [history, setHistory] = useState<any[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(propTestId || null);

  const [adminTests, setAdminTests] = useState<any[]>([]);
  const [testsLoading, setTestsLoading] = useState(false);
  const [selectedAdminTest, setSelectedAdminTest] = useState<{ id: string; title: string } | null>(
    propTestId ? { id: propTestId, title: propTestTitle ?? '' } : null
  );
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState<string | null>(null);

  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isAdmin && view === 'discovery') {
      setHistLoading(true);
      api.get('/attempts/my')
        .then(r => setHistory(r.data.attempts ?? []))
        .catch(console.error)
        .finally(() => setHistLoading(false));
    }
  }, [view, isAdmin]);

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
    else if (view === 'discovery') { openWindow('tests'); }
  };

  return (
    <div className="h-full flex flex-col bg-transparent animate-in fade-in duration-700 overflow-hidden">
      {/* Universal Header */}
      <div className="flex items-center gap-6 p-8 border-b border-white/5 bg-white/[0.01] backdrop-blur-xl shrink-0">
        <button onClick={handleBack} className="p-4 rounded-2xl hover:bg-white/5 transition-all border border-white/5 active:scale-90 group">
          <FiArrowLeft className="text-secondary group-hover:text-primary transition-colors text-xl" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-black text-primary tracking-tighter flex items-center gap-4 uppercase relative">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
              <FiShield className="text-red-500" />
            </div>
            {view === 'tests' ? 'Security Registry' :
              view === 'students' ? selectedAdminTest?.title :
                view === 'admin-audit' ? `Forensic Audit: ${selectedStudentName}` :
                  'Integrity Discovery'}
          </h1>
          <p className="text-[10px] font-black uppercase text-secondary tracking-[0.3em] mt-2 opacity-30">
            {view === 'tests' ? 'Infrastructure Visibility Mode' :
              view === 'students' ? 'Behavioral Data Acquisition' :
                'Telemetry Verification Console'}
          </p>
        </div>

        {(view === 'discovery' || view === 'tests') && (
          <div className="relative w-80 group">
            <FiSearch className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-accent transition-colors" />
            <input
              type="text" placeholder="Locate Registry Record..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-14 pr-6 py-4 glass-2 border border-white/5 rounded-[1.5rem] text-[11px] text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all font-black uppercase tracking-[0.2em] placeholder:text-white/10"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar bg-black/5">

        {isAdmin && view === 'tests' && (
          <div className="p-10 max-w-6xl mx-auto">
            {testsLoading ? (
              <div className="h-96 flex items-center justify-center">
                <OrbitalBuffer size={48} className="text-accent" />
              </div>
            ) : filteredTests.length === 0 ? (
              <div className="py-32 text-center glass-2 border-dashed border-white/10 rounded-[3.5rem]">
                <FiList className="mx-auto text-5xl text-white/5 mb-6" />
                <p className="text-[12px] font-black text-white/20 tracking-[0.5em] uppercase">No Test Data Synchronized</p>
              </div>
            ) : (
              <AnimatedList items={filteredTests} className="grid grid-cols-1" gap={16} renderItem={(t) => {
                const statusColor = t.status === 'ended' ? '#4ade80' : t.status === 'active' ? '#facc15' : 'rgba(255,255,255,0.2)';
                return (
                  <div
                    onClick={() => { setSelectedAdminTest({ id: t.id, title: t.title }); setSearch(''); setView('students'); }}
                    className="group glass-2 p-10 flex items-center gap-8 rounded-[3.5rem] border border-white/5 hover:bg-white/[0.05] hover:border-accent/30 cursor-pointer transition-all active:scale-[0.98] relative overflow-hidden shadow-xl"
                  >
                    <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-accent/10 transition-colors shadow-2xl shrink-0">
                      <FiLayers className="text-secondary group-hover:text-accent text-2xl transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0 relative z-10">
                      <div className="flex items-center gap-4">
                        <h3 className="text-xl font-black text-primary truncate uppercase tracking-tight group-hover:text-accent transition-colors">{t.title}</h3>
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-current opacity-60" style={{ color: statusColor }}>
                          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: statusColor }} />
                          <span className="text-[8px] font-black tracking-widest uppercase">{t.status}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-secondary font-black uppercase tracking-[0.3em] opacity-40 mt-2">
                        {t.subject} · {t.year} · {t.division}
                      </p>
                    </div>
                    <FiChevronRight className="text-secondary opacity-10 group-hover:translate-x-2 group-hover:opacity-100 transition-all text-2xl" />
                  </div>
                );
              }} />
            )}
          </div>
        )}

        {isAdmin && view === 'students' && selectedAdminTest && (
          <AdminStudentList testId={selectedAdminTest.id} testTitle={selectedAdminTest.title} onSelectStudent={(aId, name) => { setSelectedAttemptId(aId); setSelectedStudentName(name); setView('admin-audit'); }} />
        )}

        {isAdmin && view === 'admin-audit' && selectedAttemptId && selectedAdminTest && (
          <AdminAttemptAudit attemptId={selectedAttemptId} testId={selectedAdminTest.id} studentName={selectedStudentName ?? 'Subject'} />
        )}

        {!isAdmin && view === 'discovery' && (
          <div className="p-10 max-w-6xl mx-auto">
            {histLoading ? (
              <div className="h-96 flex items-center justify-center">
                <OrbitalBuffer size={48} className="text-accent" />
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="py-32 text-center glass-2 border-dashed border-white/10 rounded-[4.5rem]">
                <FiShield className="mx-auto text-5xl text-white/5 mb-6" />
                <p className="text-[12px] font-black text-white/20 tracking-[0.6em] uppercase">Security History Empty</p>
              </div>
            ) : (
              <AnimatedList items={filteredHistory} className="grid grid-cols-1 md:grid-cols-1" gap={16} renderItem={(h) => {
                const isAbsent = h.status === 'absent';
                return (
                  <div
                    onClick={() => { if (!isAbsent) { setSelectedTestId(h.test_id); setView('audit'); } }}
                    className={`group glass-2 p-10 flex items-center gap-8 transition-all border border-white/5 rounded-[3.5rem] relative overflow-hidden shadow-xl ${isAbsent ? 'cursor-not-allowed opacity-30 grayscale' : 'hover:bg-white/[0.05] hover:border-accent/40 cursor-pointer active:scale-[0.98]'
                      }`}
                  >
                    <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10 shadow-2xl shrink-0">
                      {isAbsent ? <FiSlash className="text-red-500 opacity-60" /> : <FiActivity className="text-secondary group-hover:text-accent text-2xl" />}
                    </div>
                    <div className="flex-1 min-w-0 relative z-10">
                      <div className="flex items-center gap-4">
                        <h3 className="text-xl font-black text-primary truncate uppercase tracking-tight group-hover:text-accent transition-colors">{h.test_title}</h3>
                        {isAbsent && <span className="text-[8px] font-black bg-red-500/20 text-red-500 px-3 py-1 rounded-full border border-red-500/30 tracking-[0.2em] uppercase shrink-0">ABSENT</span>}
                      </div>
                      <p className="text-[10px] text-secondary font-black uppercase tracking-[0.3em] opacity-40 mt-2">
                        {isAbsent ? 'Behavioral Data Acquisition Terminated' : `Historical Snapshot Cycle · ${h.status}`}
                      </p>
                    </div>
                    {!isAbsent && <FiChevronRight className="text-secondary opacity-10 group-hover:translate-x-2 group-hover:opacity-100 transition-all text-2xl" />}
                  </div>
                );
              }} />
            )}
          </div>
        )}

        {!isAdmin && view === 'audit' && selectedTestId && (
          <StudentAuditView testId={selectedTestId} />
        )}

      </div>
    </div>
  );
}
