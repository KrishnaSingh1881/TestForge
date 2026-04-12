import { useEffect, useRef, useState } from 'react';
import api from '../../lib/axios';

interface Option {
  id: string;
  option_text: string;
  option_image_url: string | null;
}

interface Question {
  id: string;
  type: 'mcq_single' | 'mcq_multi';
  statement: string;
  statement_image_url: string | null;
  marks: number;
  options: Option[];
  saved_response: { selected_option_ids: string[] } | null;
}

interface Props {
  question: Question;
  attemptId: string;
  questionNumber: number;
  isMarkedForReview: boolean;
  onAnswered: (questionId: string, answered: boolean) => void;
  onToggleReview: (questionId: string) => void;
}

export default function MCQQuestion({
  question, attemptId, questionNumber, isMarkedForReview, onAnswered, onToggleReview,
}: Props) {
  const isMulti = question.type === 'mcq_multi';

  const [selected, setSelected] = useState<string[]>(
    question.saved_response?.selected_option_ids ?? []
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const startTime = useRef(Date.now());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstClickTime = useRef<number | null>(null);
  const changeCount = useRef(0);

  // Reset when question changes
  useEffect(() => {
    setSelected(question.saved_response?.selected_option_ids ?? []);
    startTime.current = Date.now();
    firstClickTime.current = null;
    changeCount.current = 0;
    setSaveError('');
  }, [question.id]);

  async function saveResponse(ids: string[]) {
    setSaving(true);
    setSaveError('');
    const timeToFirstClick = firstClickTime.current !== null
      ? firstClickTime.current - startTime.current
      : null;
    try {
      await api.post(`/attempts/${attemptId}/responses`, {
        question_id:         question.id,
        selected_option_ids: ids,
        time_spent_seconds:  Math.floor((Date.now() - startTime.current) / 1000),
        behavioral_meta: {
          time_to_first_keystroke: timeToFirstClick,
          edit_count: changeCount.current,
          paste_events: 0,
          backspace_count: 0,
          wpm_consistency: 0,
          idle_periods: [],
          test_runs_before_submit: 0,
        },
      });
      onAnswered(question.id, ids.length > 0);
    } catch {
      setSaveError('Failed to save — retrying...');
    } finally {
      setSaving(false);
    }
  }

  function handleSelect(optId: string) {
    if (firstClickTime.current === null) firstClickTime.current = Date.now();
    changeCount.current++;

    let next: string[];

    if (isMulti) {
      next = selected.includes(optId)
        ? selected.filter(id => id !== optId)
        : [...selected, optId];
    } else {
      next = [optId];
    }

    setSelected(next);

    // Debounce save by 300ms
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveResponse(next), 300);
  }

  return (
    <div className="space-y-6">
      {/* Question header */}
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20">
              Q{questionNumber} · {isMulti ? 'Multi-Choice' : 'Single-Choice'}
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-black/5 text-secondary opacity-60 rounded-full border border-white/5">
              {question.marks} mark{question.marks !== 1 ? 's' : ''}
            </span>
            {saving && (
              <span className="text-[10px] font-black uppercase tracking-widest text-secondary opacity-40 flex items-center gap-2">
                <span className="w-3 h-3 border border-indigo-400/40 border-t-indigo-400 rounded-full animate-spin inline-block" />
                Auto-Saving...
              </span>
            )}
            {saveError && <span className="text-[10px] font-black uppercase tracking-widest text-red-400">{saveError}</span>}
          </div>

          <p className="text-lg font-bold text-primary leading-relaxed uppercase tracking-tight">
            {question.statement}
          </p>

          {question.statement_image_url && (
            <div className="mt-6 glass no-shadow p-2 rounded-3xl border-white/5 inline-block">
                <img src={question.statement_image_url} alt="question" className="max-h-64 rounded-2xl object-contain shadow-2xl" />
            </div>
          )}
        </div>

        {/* Mark for review */}
        <button
          onClick={() => onToggleReview(question.id)}
          className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${isMarkedForReview ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40 shadow-lg shadow-yellow-500/20' : 'bg-black/5 text-secondary border-white/5 hover:bg-black/10'}`}
        >
          {isMarkedForReview ? '★ Marked' : '☆ Mark Review'}
        </button>
      </div>

      {isMulti && (
        <p className="text-[10px] font-black uppercase tracking-widest text-secondary opacity-40 ml-1">
          Select all applicable options
        </p>
      )}

      {/* Options */}
      <div className="grid gap-3">
        {question.options.map((opt, i) => {
          const isSelected = selected.includes(opt.id);

          return (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              className={`group w-full flex items-start gap-4 p-5 rounded-3xl text-left transition-all border ${isSelected ? 'bg-indigo-500/10 border-indigo-500/40 shadow-xl shadow-indigo-500/10 translate-x-1' : 'bg-black/5 border-white/5 hover:bg-black/10 hover:border-white/20'}`}
            >
              {/* Radio / Checkbox indicator */}
              <div className={`shrink-0 mt-0.5 w-6 h-6 rounded-xl flex items-center justify-center border-2 transition-all ${isSelected ? 'bg-indigo-500 border-indigo-500 scale-110 shadow-lg shadow-indigo-500/30' : 'bg-black/10 border-white/10 group-hover:border-indigo-500/30'}`}>
                {isSelected && (
                  <span className="text-white text-[10px] font-black leading-none animate-in zoom-in duration-300">
                    {isMulti ? '✓' : '●'}
                  </span>
                )}
              </div>

              {/* Option label */}
              <span className={`text-xs font-black shrink-0 mt-1 w-6 opacity-40 ${isSelected ? 'text-indigo-400 opacity-100' : 'text-secondary'}`}>
                {String.fromCharCode(65 + i)}
              </span>

              {/* Option content */}
              <div className="flex-1 min-w-0">
                {opt.option_text && (
                  <p className={`text-sm font-bold leading-relaxed uppercase tracking-tight ${isSelected ? 'text-primary' : 'text-primary opacity-80'}`}>
                    {opt.option_text}
                  </p>
                )}
                {opt.option_image_url && (
                  <div className="mt-4 glass no-shadow p-1.5 rounded-2xl border-white/5 inline-block">
                    <img src={opt.option_image_url} alt={`option ${i}`} className="max-h-40 rounded-xl object-contain" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Clear selection */}
      {selected.length > 0 && (
        <button
          onClick={() => { setSelected([]); saveResponse([]); }}
          className="px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-secondary opacity-40 hover:opacity-100 hover:text-red-400 transition-all"
        >
          Clear Current Selection
        </button>
      )}
    </div>
  );
}
