import { useEffect, useState } from 'react';
import api from '../../../lib/axios';
import {
  FiShield, FiAlertTriangle, FiActivity, FiSearch,
  FiCheckCircle, FiSlash, FiList, FiPlay, FiLayers, FiCpu, FiClock,
} from 'react-icons/fi';
import OrbitalBuffer from '../../components/OrbitalBuffer';

interface Props {
  attemptId: string;
  testId: string;
  studentName: string;
}

function scoreColor(score: number | null) {
  if (score === null || score === undefined) return 'rgba(255,255,255,0.4)';
  if (score >= 90) return '#4ade80';
  if (score >= 70) return '#facc15';
  return '#f87171';
}

function fmtMs(ms: number | null) {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function MetricCell({ label, val, flag, icon, na }: {
  label: string; val: any; flag?: boolean; icon: any; na?: boolean;
}) {
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

export default function AttemptAuditPanel({ attemptId, testId, studentName }: Props) {
  const [data, setData]         = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditResult, setAuditResult]   = useState<any>(null);

  useEffect(() => {
    api.get(`/admin/tests/${testId}/integrity`)
      .then(r => {
        const found = (r.data.attempts ?? []).find(
          (a: any) => a.id === attemptId || a.attempt_id === attemptId
        );
        if (!found) { setError('Student audit not found'); return; }
        setData(found);
      })
      .catch(e => setError(e.response?.data?.error ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, [attemptId, testId]);

  const runAiAudit = async () => {
    setAuditLoading(true);
    try {
      const r = await api.post(`/admin/attempts/${attemptId}/audit`);
      setAuditResult(r.data);
    } catch {
      alert('AI Audit failed. Ensure local Ollama is running.');
    } finally { setAuditLoading(false); }
  };

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <OrbitalBuffer size={40} className="text-accent" />
    </div>
  );
  if (error || !data) return (
    <div className="h-full flex items-center justify-center flex-col gap-3">
      <FiShield className="text-4xl text-white/10" />
      <p className="text-red-400 font-black text-sm uppercase tracking-widest">{error || 'No data'}</p>
    </div>
  );

  const highFlags = (data.behavioral_flags ?? []).filter((f: any) => f.severity === 'high');
  const medFlags  = (data.behavioral_flags ?? []).filter((f: any) => f.severity === 'medium');
  const allFlags  = [...highFlags, ...medFlags];
  const details   = data.behavioral_detail ?? [];

  const codingDetails = details.filter((d: any) =>
    d.question_type === 'debugging' || d.question_type === 'coding' ||
    (!d.question_type && d.test_runs_before_submit !== undefined)
  );
  const mcqDetails = details.filter((d: any) =>
    d.question_type === 'mcq_single' || d.question_type === 'mcq_multi'
  );

  const severityStyle = (sev: string) =>
    sev === 'high'
      ? { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', badge: 'bg-red-500/20 text-red-400' }
      : { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', badge: 'bg-amber-500/20 text-amber-400' };

  return (
    <div className="p-8 space-y-8 max-w-5xl mx-auto pb-24 animate-in fade-in slide-in-from-bottom-6">

      {/* AI Forensic Audit */}
      <div className={`p-8 rounded-[3rem] border transition-all ${auditResult ? 'border-red-500/20 bg-red-500/[0.02]' : 'glass-2'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${auditResult ? 'bg-red-500/10' : 'bg-white/5'}`}>
              <FiCpu className={`text-xl ${auditResult ? 'text-red-500' : 'text-secondary opacity-40'}`} />
            </div>
            <div>
              <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em]">Cognitive Forensic Audit</h3>
              <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-30 mt-0.5">Local AI Processing</p>
            </div>
          </div>
          {!auditResult && (
            <button
              onClick={runAiAudit}
              disabled={auditLoading}
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all border border-white/10 active:scale-95"
            >
              {auditLoading ? 'Processing...' : 'Run AI Audit'}
            </button>
          )}
        </div>

        {auditResult && (
          <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-4 gap-4 animate-in fade-in duration-500">
            <div className="glass-2 p-5 rounded-2xl border-white/5">
              <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40 mb-1">Confidence</p>
              <p className={`text-3xl font-black tabular-nums ${auditResult.suspicion_score > 60 ? 'text-red-500' : 'text-amber-500'}`}>
                {auditResult.suspicion_score}%
              </p>
            </div>
            <div className="col-span-3 glass-2 p-5 rounded-2xl border-white/5">
              <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40 mb-1">Observations</p>
              <p className="text-sm text-primary/80 font-bold leading-relaxed">{auditResult.narrative}</p>
              <span className="mt-3 inline-block text-[9px] font-black text-red-500 px-3 py-1 bg-red-500/10 rounded-full border border-red-500/20">
                Flag: {auditResult.primary_flag}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Session Metrics */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Score', val: `${data.total_score ?? 0}/${data.total_marks ?? 0}`, color: 'rgb(var(--accent))' },
          { label: 'Tab Switches', val: data.tab_switches ?? 0, color: (data.tab_switches ?? 0) >= 3 ? '#f87171' : '#4ade80' },
          { label: 'Focus Loss', val: data.focus_lost_count ?? 0, color: (data.focus_lost_count ?? 0) >= 5 ? '#f87171' : '#4ade80' },
          { label: 'Flags', val: allFlags.length, color: allFlags.length >= 3 ? '#f87171' : allFlags.length >= 1 ? '#facc15' : '#4ade80' },
        ].map((s, i) => (
          <div key={i} className="glass-2 p-6 rounded-2xl border-white/5 text-center">
            <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40 mb-2">{s.label}</p>
            <p className="text-3xl font-black tabular-nums" style={{ color: s.color }}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Behavioral flags */}
      {allFlags.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-black text-secondary uppercase tracking-[0.4em] opacity-40 px-2">
            Anomaly Detection ({allFlags.length})
          </p>
          {allFlags.map((f: any, i: number) => {
            const st = severityStyle(f.severity);
            return (
              <div key={i} className={`glass-2 p-5 flex items-center justify-between rounded-[2rem] border-white/5 ${st.bg}`}>
                <div className="flex items-center gap-5">
                  <div className={`p-3 rounded-xl ${st.bg} border ${st.border}`}>
                    <FiAlertTriangle className={`${st.text}`} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-primary uppercase tracking-wide">{f.label}</p>
                    <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40 mt-0.5">
                      {f.type?.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-xl border ${st.badge} ${st.border}`}>
                  {f.severity}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Coding analysis */}
      {codingDetails.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-2">
            <FiActivity className="text-accent opacity-40" />
            <p className="text-[10px] font-black text-secondary uppercase tracking-[0.4em] opacity-60">
              Coding Analysis ({codingDetails.length})
            </p>
          </div>
          {codingDetails.map((d: any, i: number) => {
            const attempted  = d.time_to_first_keystroke !== null || (d.backspace_count ?? 0) > 0 || (d.edit_count ?? 0) > 0;
            const hasPaste   = (d.paste_events ?? 0) > 0;
            const fastStart  = attempted && (d.time_to_first_keystroke ?? 99999) < 3000;
            const highWpm    = (d.wpm_consistency ?? 0) > 100;
            const noFix      = attempted && (d.backspace_count ?? 99) <= 2 && highWpm;
            const noRuns     = attempted && (d.test_runs_before_submit ?? 1) === 0;
            const flagCount  = [hasPaste, fastStart, highWpm, noFix, noRuns].filter(Boolean).length;

            return (
              <div key={i} className={`glass-2 rounded-[2.5rem] border overflow-hidden ${!attempted ? 'border-white/5 opacity-50' : flagCount >= 2 ? 'border-red-500/30' : flagCount >= 1 ? 'border-amber-500/20' : 'border-green-500/20'}`}>
                <div className={`px-6 py-4 flex items-center justify-between border-b border-white/5 ${flagCount >= 2 ? 'bg-red-500/[0.03]' : flagCount >= 1 ? 'bg-amber-500/[0.02]' : 'bg-green-500/[0.02]'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-xl bg-white/5 border border-white/5 text-secondary">
                      Q{i + 1}
                    </span>
                    {hasPaste  && <span className="text-[9px] font-black uppercase bg-red-500/20 text-red-400 px-2.5 py-0.5 rounded-full border border-red-500/20">Paste</span>}
                    {fastStart && <span className="text-[9px] font-black uppercase bg-red-500/20 text-red-400 px-2.5 py-0.5 rounded-full border border-red-500/20">Pre-prepared</span>}
                    {!attempted && <span className="text-[9px] font-black uppercase text-secondary opacity-30">Not Attempted</span>}
                  </div>
                  {attempted && flagCount === 0 && (
                    <span className="text-[9px] font-black text-green-400 uppercase tracking-widest flex items-center gap-1.5">
                      <FiCheckCircle /> Authentic
                    </span>
                  )}
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    <MetricCell label="Time to Start" val={fmtMs(d.time_to_first_keystroke)} flag={fastStart} icon={<FiActivity />} na={!attempted} />
                    <MetricCell label="WPM" val={`${Math.round(d.wpm_consistency ?? 0)}`} flag={highWpm} icon={<FiList />} na={!attempted} />
                    <MetricCell label="Corrections" val={d.backspace_count ?? 0} flag={noFix} icon={<FiSlash />} na={!attempted} />
                    <MetricCell label="Paste Events" val={d.paste_events ?? 0} flag={hasPaste} icon={<FiLayers />} na={!attempted} />
                    <MetricCell label="Edits" val={d.edit_count ?? 0} icon={<FiSearch />} na={!attempted} />
                    <MetricCell label="Test Runs" val={d.test_runs_before_submit ?? '—'} flag={noRuns} icon={<FiPlay />} na={!attempted} />
                  </div>

                  {/* Idle periods */}
                  {attempted && (d.idle_periods ?? []).length > 0 && (
                    <div className="mt-5 pt-5 border-t border-white/5">
                      <p className="text-[9px] font-black text-secondary uppercase tracking-widest opacity-40 mb-2 flex items-center gap-1.5">
                        <FiClock /> Idle Gaps
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {d.idle_periods.map((p: any, k: number) => {
                          const dur = p.duration_seconds ?? p.duration ?? 0;
                          return (
                            <div key={k} className={`px-4 py-2 rounded-xl border text-sm font-black tabular-nums ${dur > 180 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-white/5 border-white/5 text-secondary opacity-60'}`}>
                              {dur >= 60 ? `${Math.round(dur / 60)}m` : `${dur}s`}
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
          <p className="text-[10px] font-black text-secondary uppercase tracking-[0.4em] opacity-40 px-2">
            MCQ Response Telemetry ({mcqDetails.length})
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mcqDetails.map((d: any, i: number) => {
              const attempted  = d.time_to_first_keystroke !== null || (d.edit_count ?? 0) > 0;
              const fastClick  = attempted && (d.time_to_first_keystroke ?? 99999) < 2000;
              return (
                <div key={i} className={`glass-2 p-6 rounded-[2rem] border-white/5 ${!attempted ? 'opacity-40' : ''}`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-secondary opacity-40">MCQ #{i + 1}</span>
                    {fastClick && <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">Fast Click</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <MetricCell label="Reaction" val={fmtMs(d.time_to_first_keystroke)} flag={fastClick} icon={<FiActivity />} na={!attempted} />
                    <MetricCell label="Revisions" val={d.edit_count ?? 0} icon={<FiSearch />} na={!attempted} />
                    <MetricCell label="Time Spent" val={d.time_spent_seconds ? `${d.time_spent_seconds}s` : '—'} icon={<FiClock />} na={!attempted} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {allFlags.length === 0 && details.length === 0 && (
        <div className="py-20 text-center glass-2 border-dashed border-white/10 rounded-[3rem]">
          <FiCheckCircle className="mx-auto text-4xl text-green-500/10 mb-4" />
          <p className="text-[11px] font-black text-secondary uppercase tracking-[0.5em] opacity-40">
            No behavioral anomalies detected
          </p>
        </div>
      )}
    </div>
  );
}
