import { useEffect, useState } from 'react';
import api from '../../../lib/axios';
import {
  FiShield, FiActivity, FiPlay, FiArrowLeft,
} from 'react-icons/fi';
import OrbitalBuffer from '../../components/OrbitalBuffer';

export default function SimilarityFlagsPanel({ testId }: { testId: string }) {
  const [flags, setFlags]           = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [running, setRunning]       = useState(false);
  const [runResult, setRunResult]   = useState('');
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
      setRunResult(`${r.data.flags_raised} new flags from ${r.data.pairs_analyzed} pairs`);
      loadFlags();
    } catch (e: any) {
      setRunResult(e.response?.data?.error ?? 'Analysis failed');
    } finally { setRunning(false); }
  }

  async function setVerdict(flagId: string, verdict: 'confirmed' | 'dismissed') {
    try {
      await api.patch(`/admin/flags/${flagId}/verdict`, { verdict });
      setFlags(prev => prev.map(f => f.id === flagId ? { ...f, admin_verdict: verdict, reviewed: true } : f));
      if (selectedFlag?.id === flagId) setSelectedFlag((p: any) => ({ ...p, admin_verdict: verdict, reviewed: true }));
    } catch (e: any) { alert(e.response?.data?.error ?? 'Failed'); }
  }

  if (loading) return (
    <div className="h-64 flex items-center justify-center">
      <OrbitalBuffer size={40} className="text-accent" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black text-secondary uppercase tracking-[0.3em] opacity-40">
          {flags.length} similarity flag{flags.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={runSimilarity}
          disabled={running}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-accent text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-accent/20 hover:opacity-90 active:scale-95 transition-all"
        >
          <FiPlay className="text-xs" />
          {running ? 'Analyzing...' : 'Run Similarity Check'}
        </button>
      </div>

      {runResult && (
        <div className="px-5 py-3 glass-2 border-white/10 rounded-2xl">
          <p className="text-[10px] font-black text-secondary uppercase tracking-widest">{runResult}</p>
        </div>
      )}

      {flags.length === 0 ? (
        <div className="py-24 text-center glass-2 border-dashed border-white/10 rounded-[3rem]">
          <FiShield className="mx-auto text-4xl text-white/10 mb-4" />
          <p className="text-[11px] font-black text-white/20 tracking-[0.5em] uppercase">No Similarity Flags</p>
        </div>
      ) : (
        <div className={`grid gap-6 ${selectedFlag ? 'grid-cols-12' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
          {/* Flag list */}
          <div className={`${selectedFlag ? 'col-span-4' : ''} space-y-3 max-h-[600px] overflow-auto pr-2 custom-scrollbar`}>
            {flags.map((f: any) => {
              const pct = Math.round(f.similarity_score * 100);
              const isSelected = selectedFlag?.id === f.id;
              return (
                <div
                  key={f.id}
                  onClick={() => setSelectedFlag(f)}
                  className={`glass-2 p-5 rounded-[2rem] cursor-pointer transition-all border border-white/5 hover:bg-white/[0.05] ${isSelected ? 'border-red-500/40 bg-red-500/[0.03]' : f.admin_verdict === 'dismissed' ? 'opacity-40 grayscale' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${pct >= 90 ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`} />
                        <p className="text-sm font-black text-primary truncate uppercase tracking-tight">
                          {f.student1} / {f.student2}
                        </p>
                      </div>
                      <p className="text-[9px] font-black text-secondary opacity-30 uppercase tracking-widest line-clamp-1">
                        {f.question_statement || 'Logic Match'}
                      </p>
                    </div>
                    <p className="text-xl font-black tabular-nums shrink-0" style={{ color: pct >= 90 ? '#f87171' : '#facc15' }}>
                      {pct}%
                    </p>
                  </div>
                  {f.admin_verdict && f.admin_verdict !== 'pending' && (
                    <div className="mt-3">
                      <span className={`text-[8px] font-black px-2.5 py-1 rounded-full border uppercase tracking-widest ${f.admin_verdict === 'confirmed' ? 'bg-red-500/20 text-red-500 border-red-500/20' : 'bg-white/5 text-secondary border-white/10'}`}>
                        {f.admin_verdict === 'confirmed' ? '⚠ Confirmed' : '✓ Dismissed'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detail panel */}
          {selectedFlag && (
            <div className="col-span-8 glass-2 rounded-[2.5rem] border-white/5 overflow-hidden flex flex-col h-[600px] animate-in fade-in slide-in-from-right-6 duration-500">
              <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                    <span className="text-xl font-black text-red-500">{Math.round(selectedFlag.similarity_score * 100)}%</span>
                  </div>
                  <div>
                    <h3 className="text-base font-black text-primary uppercase tracking-tight">Code Comparison</h3>
                    <p className="text-[9px] font-black text-secondary opacity-30 uppercase tracking-widest mt-0.5 truncate max-w-xs">
                      {selectedFlag.question_statement}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(!selectedFlag.admin_verdict || selectedFlag.admin_verdict === 'pending') ? (
                    <>
                      <button onClick={() => setVerdict(selectedFlag.id, 'confirmed')} className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-red-600 text-white hover:bg-red-500 transition-all active:scale-95">Confirm</button>
                      <button onClick={() => setVerdict(selectedFlag.id, 'dismissed')} className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-primary hover:bg-white/10 transition-all active:scale-95">Dismiss</button>
                    </>
                  ) : (
                    <span className={`text-[9px] font-black px-4 py-2 rounded-xl border ${selectedFlag.admin_verdict === 'confirmed' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
                      {selectedFlag.admin_verdict === 'confirmed' ? '⚠ Confirmed' : '✓ Dismissed'}
                    </span>
                  )}
                  <button onClick={() => setSelectedFlag(null)} className="p-2.5 rounded-xl bg-white/5 text-secondary hover:bg-white/10 transition-all border border-white/5">
                    <FiArrowLeft />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-hidden grid grid-cols-2 divide-x divide-white/5">
                {[
                  { name: selectedFlag.student1, code: selectedFlag.code1, color: 'text-accent' },
                  { name: selectedFlag.student2, code: selectedFlag.code2, color: 'text-red-500' },
                ].map((side, i) => (
                  <div key={i} className="flex flex-col overflow-hidden">
                    <div className="px-5 py-3 bg-white/[0.01] border-b border-white/5 shrink-0">
                      <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${side.color}`}>{side.name}</p>
                    </div>
                    <pre className="flex-1 p-6 overflow-auto text-xs font-mono text-primary/80 leading-relaxed custom-scrollbar bg-black/5">
                      <code>{side.code || '// No code available'}</code>
                    </pre>
                  </div>
                ))}
              </div>

              <div className="p-5 bg-red-500/[0.02] border-t border-white/5 flex items-center gap-4 shrink-0">
                <FiActivity className="text-2xl text-red-500/30 shrink-0" />
                <p className="text-[10px] font-bold text-white/40">
                  Significant structural overlap detected in logic flow and syntax between both submissions.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
