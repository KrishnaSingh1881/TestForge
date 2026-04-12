import { useEffect, useState } from 'react';

interface Question {
  id: string;
  type: string;
  unlock_at_minutes: number;
}

interface Props {
  questions: Question[];
  currentIdx: number;
  answeredIds: Set<string>;
  reviewIds: Set<string>;
  elapsedMinutes: number;
  onSelect: (idx: number) => void;
}

function UnlockCountdown({ unlockAt, elapsed }: { unlockAt: number; elapsed: number }) {
  const remaining = Math.max(0, unlockAt - elapsed);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => forceUpdate(n => n + 1), 1000);
    return () => clearInterval(id);
  }, [remaining]);

  const mins = Math.floor(remaining);
  const secs = Math.round((remaining - mins) * 60);
  return <span className="text-xs font-mono">{mins}:{String(secs).padStart(2, '0')}</span>;
}

export default function QuestionNavigator({
  questions, currentIdx, answeredIds, reviewIds, elapsedMinutes, onSelect,
}: Props) {
  return (
    <aside className="w-56 shrink-0 flex flex-col gap-3 p-4"
      style={{ borderRight: '1px solid var(--glass-border)' }}>
      <p className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'rgb(var(--text-secondary))' }}>
        Questions
      </p>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" /> Current
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Answered
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /> Review
        </span>
      </div>

      {/* Grid of question buttons */}
      <div className="grid grid-cols-4 gap-2">
        {questions.map((q, idx) => {
          const locked   = elapsedMinutes < q.unlock_at_minutes;
          const isCurrent  = idx === currentIdx;
          const isAnswered = answeredIds.has(q.id);
          const isReview   = reviewIds.has(q.id);

          let bg = 'bg-black/5';
          let color = 'text-secondary opacity-60';
          let border = 'border-white/10';

          if (locked) {
            bg = 'bg-black/10';
            color = 'text-secondary opacity-20';
          } else if (isCurrent) {
            bg = 'bg-indigo-500/30';
            color = 'text-indigo-400';
            border = 'border-indigo-500/50';
          } else if (isReview) {
            bg = 'bg-yellow-500/20';
            color = 'text-yellow-400';
            border = 'border-yellow-500/40';
          } else if (isAnswered) {
            bg = 'bg-green-500/20';
            color = 'text-green-400';
            border = 'border-green-500/40';
          }

          return (
            <button
              key={q.id}
              disabled={locked}
              onClick={() => !locked && onSelect(idx)}
              className={`relative w-full aspect-square rounded-xl text-[10px] font-black flex items-center justify-center transition-all border ${bg} ${color} ${border}`}
              style={{ cursor: locked ? 'not-allowed' : 'pointer' }}>
              {locked ? '🔒' : idx + 1}
            </button>
          );
        })}
      </div>

      {/* Locked question countdown */}
      {questions.some(q => elapsedMinutes < q.unlock_at_minutes) && (
        <div className="space-y-1.5 mt-2">
          {questions
            .filter(q => elapsedMinutes < q.unlock_at_minutes)
            .map((q, i) => (
              <div key={q.id} className="flex items-center justify-between text-[10px] font-black uppercase tracking-tight px-3 py-2 rounded-xl bg-black/5 text-secondary border border-white/5">
                <span className="opacity-40">Q{questions.indexOf(q) + 1} unlocks in</span>
                <UnlockCountdown unlockAt={q.unlock_at_minutes} elapsed={elapsedMinutes} />
              </div>
            ))}
        </div>
      )}

      {/* Summary */}
      <div className="mt-auto pt-4 border-t border-white/5 text-[10px] font-black uppercase tracking-widest space-y-2 text-secondary">
        <div className="flex justify-between">
          <span>Answered</span>
          <span style={{ color: '#4ade80' }}>{answeredIds.size}/{questions.length}</span>
        </div>
        <div className="flex justify-between">
          <span>Marked</span>
          <span style={{ color: '#facc15' }}>{reviewIds.size}</span>
        </div>
      </div>
    </aside>
  );
}
