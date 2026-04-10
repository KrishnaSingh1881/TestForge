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

  // Reset when question changes
  useEffect(() => {
    setSelected(question.saved_response?.selected_option_ids ?? []);
    startTime.current = Date.now();
    setSaveError('');
  }, [question.id]);

  async function saveResponse(ids: string[]) {
    setSaving(true);
    setSaveError('');
    try {
      await api.post(`/attempts/${attemptId}/responses`, {
        question_id:         question.id,
        selected_option_ids: ids,
        time_spent_seconds:  Math.floor((Date.now() - startTime.current) / 1000),
      });
      onAnswered(question.id, ids.length > 0);
    } catch {
      setSaveError('Failed to save — retrying...');
    } finally {
      setSaving(false);
    }
  }

  function handleSelect(optId: string) {
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
    <div className="space-y-5">
      {/* Question header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: 'rgb(var(--accent))' }}>
              Q{questionNumber} · {isMulti ? 'Multi Correct' : 'Single Correct'}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgb(var(--text-secondary))' }}>
              {question.marks} mark{question.marks !== 1 ? 's' : ''}
            </span>
            {saving && (
              <span className="text-xs flex items-center gap-1" style={{ color: 'rgb(var(--text-secondary))' }}>
                <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                Saving...
              </span>
            )}
            {saveError && <span className="text-xs text-red-400">{saveError}</span>}
          </div>

          <p className="text-base leading-relaxed" style={{ color: 'rgb(var(--text-primary))' }}>
            {question.statement}
          </p>

          {question.statement_image_url && (
            <img src={question.statement_image_url} alt="question"
              className="mt-3 max-h-48 rounded-xl object-contain" />
          )}
        </div>

        {/* Mark for review */}
        <button
          onClick={() => onToggleReview(question.id)}
          className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            backgroundColor: isMarkedForReview ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.07)',
            color: isMarkedForReview ? '#facc15' : 'rgb(var(--text-secondary))',
            border: `1px solid ${isMarkedForReview ? 'rgba(234,179,8,0.4)' : 'var(--glass-border)'}`,
          }}>
          {isMarkedForReview ? '★ Marked' : '☆ Mark'}
        </button>
      </div>

      {isMulti && (
        <p className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
          Select all that apply
        </p>
      )}

      {/* Options */}
      <div className="space-y-2.5">
        {question.options.map((opt, i) => {
          const isSelected = selected.includes(opt.id);

          return (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              className="w-full flex items-start gap-3 p-4 rounded-xl text-left transition-all"
              style={{
                backgroundColor: isSelected ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isSelected ? 'rgba(99,102,241,0.5)' : 'var(--glass-border)'}`,
                transform: isSelected ? 'scale(1.005)' : 'scale(1)',
              }}>
              {/* Radio / Checkbox indicator */}
              <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 transition-all"
                style={{
                  borderColor: isSelected ? 'rgb(var(--accent))' : 'rgba(148,163,184,0.5)',
                  backgroundColor: isSelected ? 'rgb(var(--accent))' : 'transparent',
                  borderRadius: isMulti ? '4px' : '50%',
                }}>
                {isSelected && (
                  <span className="text-white text-xs font-bold leading-none">
                    {isMulti ? '✓' : '●'}
                  </span>
                )}
              </span>

              {/* Option label */}
              <span className="text-xs font-bold shrink-0 mt-0.5 w-4"
                style={{ color: isSelected ? 'rgb(var(--accent))' : 'rgb(var(--text-secondary))' }}>
                {String.fromCharCode(65 + i)}
              </span>

              {/* Option content */}
              <div className="flex-1 min-w-0">
                {opt.option_text && (
                  <p className="text-sm leading-relaxed" style={{ color: 'rgb(var(--text-primary))' }}>
                    {opt.option_text}
                  </p>
                )}
                {opt.option_image_url && (
                  <img src={opt.option_image_url} alt={`option ${i}`}
                    className="mt-2 max-h-28 rounded-lg object-contain" />
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
          className="text-xs transition-opacity hover:opacity-70"
          style={{ color: 'rgb(var(--text-secondary))' }}>
          Clear selection
        </button>
      )}
    </div>
  );
}
