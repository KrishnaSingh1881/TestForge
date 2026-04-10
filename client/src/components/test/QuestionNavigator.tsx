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
      <div className="grid grid-cols-4 gap-1.5">
        {questions.map((q, idx) => {
          const locked   = elapsedMinutes < q.unlock_at_minutes;
          const isCurrent  = idx === currentIdx;
          const isAnswered = answeredIds.has(q.id);
          const isReview   = reviewIds.has(q.id);

          let bg = 'rgba(255,255,255,0.07)';
          let color = 'rgb(var(--text-secondary))';
          let border = 'var(--glass-border)';

          if (locked) {
            bg = 'rgba(255,255,255,0.03)';
            color = 'rgba(148,163,184,0.4)';
          } else if (isCurrent) {
            bg = 'rgba(99,102,241,0.3)';
            color = 'rgb(var(--accent))';
            border = 'rgba(99,102,241,0.6)';
          } else if (isReview) {
            bg = 'rgba(234,179,8,0.15)';
            color = '#facc15';
            border = 'rgba(234,179,8,0.4)';
          } else if (isAnswered) {
            bg = 'rgba(74,222,128,0.15)';
            color = '#4ade80';
            border = 'rgba(74,222,128,0.4)';
          }

          return (
            <button
              key={q.id}
              disabled={locked}
              onClick={() => !locked && onSelect(idx)}
              title={locked ? `Unlocks at ${q.unlock_at_minutes} min` : `Question ${idx + 1}`}
              className="relative w-full aspect-square rounded-lg text-xs font-semibold flex items-center justify-center transition-all"
              style={{ backgroundColor: bg, color, border: `1px solid ${border}`, cursor: locked ? 'not-allowed' : 'pointer' }}>
              {locked ? '🔒' : idx + 1}
            </button>
          );
        })}
      </div>

      {/* Locked question countdown */}
      {questions.some(q => elapsedMinutes < q.unlock_at_minutes) && (
        <div className="space-y-1 mt-1">
          {questions
            .filter(q => elapsedMinutes < q.unlock_at_minutes)
            .map((q, i) => (
              <div key={q.id} className="flex items-center justify-between text-xs px-2 py-1 rounded-lg"
                style={{ backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgb(var(--text-secondary))' }}>
                <span>Q{questions.indexOf(q) + 1} unlocks in</span>
                <UnlockCountdown unlockAt={q.unlock_at_minutes} elapsed={elapsedMinutes} />
              </div>
            ))}
        </div>
      )}

      {/* Summary */}
      <div className="mt-auto pt-3 border-t text-xs space-y-1"
        style={{ borderColor: 'var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
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
