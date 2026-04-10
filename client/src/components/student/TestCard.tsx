import { Link } from 'react-router-dom';
import { useCountdown } from '../../hooks/useCountdown';

interface Attempt { id: string; status: string; }

interface Test {
  id: string;
  title: string;
  subject: string;
  year: string;
  division: string;
  duration_mins: number;
  start_time: string;
  end_time: string;
  questions_per_attempt: number;
  total_marks: number;
  attempt: Attempt | null;
}

export default function TestCard({ test }: { test: Test }) {
  const now = Date.now();
  const started = new Date(test.start_time).getTime() <= now;
  const countdown = useCountdown(!started ? test.start_time : null);

  const attempted = !!test.attempt;
  const submitted = test.attempt?.status === 'submitted' || test.attempt?.status === 'auto_submitted';

  return (
    <div className="glass p-5 flex flex-col gap-4 transition-transform hover:-translate-y-0.5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold leading-snug" style={{ color: 'rgb(var(--text-primary))' }}>
          {test.title}
        </h3>
        {test.subject && (
          <span className="text-xs px-2 py-0.5 rounded-full shrink-0 font-medium"
            style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: 'rgb(var(--accent))' }}>
            {test.subject}
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs px-2 py-0.5 rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgb(var(--text-secondary))' }}>
          {test.year} · Div {test.division}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgb(var(--text-secondary))' }}>
          ⏱ {test.duration_mins} min
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgb(var(--text-secondary))' }}>
          {test.questions_per_attempt} questions
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgb(var(--text-secondary))' }}>
          {test.total_marks} marks
        </span>
      </div>

      {/* CTA */}
      <div className="mt-auto">
        {submitted ? (
          <Link to={`/results/${test.attempt!.id}`}
            className="block w-full text-center py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
            View Results
          </Link>
        ) : attempted ? (
          <Link to={`/test/${test.attempt!.id}`}
            className="block w-full text-center py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'rgba(234,179,8,0.12)', color: '#facc15', border: '1px solid rgba(234,179,8,0.3)' }}>
            Resume Test
          </Link>
        ) : started ? (
          <Link to={`/test/${test.id}/start`}
            className="block w-full text-center py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'rgb(var(--accent))' }}>
            Attempt Now
          </Link>
        ) : (
          <div className="text-center py-2 rounded-lg text-sm"
            style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
            Starts in <span className="font-mono font-medium" style={{ color: 'rgb(var(--text-primary))' }}>{countdown}</span>
          </div>
        )}
      </div>
    </div>
  );
}
