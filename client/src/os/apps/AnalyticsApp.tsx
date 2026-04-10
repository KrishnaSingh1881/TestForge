import { useEffect, useState, useRef } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import api from '../../lib/axios';
import Lenis from 'lenis';

function pctColor(pct: number) {
  if (pct >= 70) return '#4ade80';
  if (pct >= 50) return '#facc15';
  return '#f87171';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function TrendTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="glass px-3 py-2 text-xs space-y-0.5">
      <p className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
        {d.test_title}
      </p>
      <p style={{ color: 'rgb(var(--accent))' }}>{d.percentage}%</p>
      {d.rank && <p style={{ color: 'rgb(var(--text-secondary))' }}>Rank #{d.rank}</p>}
    </div>
  );
}

function SubjectTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="glass px-3 py-2 text-xs space-y-0.5">
      <p className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
        {d.subject}
      </p>
      <p style={{ color: 'rgb(var(--accent))' }}>{d.avg_percentage}%</p>
      <p style={{ color: 'rgb(var(--text-secondary))' }}>
        {d.tests_count} test{d.tests_count !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="glass p-5">
      <p className="text-2xl font-bold" style={{ color: color ?? 'rgb(var(--accent))' }}>
        {value}
      </p>
      <p className="text-xs mt-1 font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
        {label}
      </p>
      {sub && (
        <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-secondary))' }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-sm font-semibold mb-3" style={{ color: 'rgb(var(--text-primary))' }}>
      {title}
    </p>
  );
}

const axisStyle = { fontSize: 11, fill: 'rgb(148 163 184)' };

export default function AnalyticsApp() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .get('/analytics/student')
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error ?? 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  // Lenis smooth scroll
  useEffect(() => {
    if (!containerRef.current) return;

    const lenis = new Lenis({
      wrapper: containerRef.current,
      duration: 1.2,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    const rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
            Loading analytics...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (!data || data.tests_attempted === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="glass p-12 text-center">
          <p className="text-lg mb-2" style={{ color: 'rgb(var(--text-primary))' }}>
            No data yet
          </p>
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
            Complete a test to see your analytics here.
          </p>
        </div>
      </div>
    );
  }

  const {
    tests_attempted,
    avg_percentage,
    best_rank,
    overall_accuracy,
    score_trend,
    subject_performance,
    question_type_accuracy,
    avg_time_per_question_type,
  } = data;

  return (
    <div ref={containerRef} className="h-full overflow-auto">
      <div className="p-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
            Analytics
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>
            Your performance across all tests
          </p>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Tests Attempted" value={tests_attempted} />
          <StatCard label="Average Score" value={`${avg_percentage}%`} color={pctColor(avg_percentage)} />
          <StatCard label="Best Rank" value={best_rank ? `#${best_rank}` : '—'} color="rgb(var(--accent))" />
          <StatCard
            label="Overall Accuracy"
            value={`${overall_accuracy}%`}
            sub={`MCQ ${question_type_accuracy.mcq}% · Debug ${question_type_accuracy.debugging}%`}
            color={pctColor(overall_accuracy)}
          />
        </div>

        {/* Score trend */}
        {score_trend.length > 1 && (
          <div className="glass p-5">
            <SectionHeader title="Score Trend" />
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={score_trend} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDate}
                  tick={axisStyle}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={axisStyle}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `${v}%`}
                />
                <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'rgba(99,102,241,0.3)', strokeWidth: 1 }} />
                <Line
                  type="monotone"
                  dataKey="percentage"
                  stroke="rgb(99 102 241)"
                  strokeWidth={2}
                  dot={{ fill: 'rgb(99 102 241)', r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: 'rgb(99 102 241)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Subject performance */}
        {subject_performance.length > 0 && (
          <div className="glass p-5">
            <SectionHeader title="Subject Performance" />
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={subject_performance} barSize={36} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="subject" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[0, 100]}
                  tick={axisStyle}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `${v}%`}
                />
                <Tooltip content={<SubjectTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="avg_percentage" radius={[4, 4, 0, 0]}>
                  {subject_performance.map((s: any, i: number) => (
                    <Cell key={i} fill={pctColor(s.avg_percentage)} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Question type accuracy */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass p-5">
            <p className="text-xs font-medium mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>
              MCQ Accuracy
            </p>
            <p className="text-3xl font-bold" style={{ color: pctColor(question_type_accuracy.mcq) }}>
              {question_type_accuracy.mcq}%
            </p>
            {avg_time_per_question_type.mcq > 0 && (
              <p className="text-xs mt-2" style={{ color: 'rgb(var(--text-secondary))' }}>
                Avg {avg_time_per_question_type.mcq}s per question
              </p>
            )}
          </div>
          <div className="glass p-5">
            <p className="text-xs font-medium mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>
              Debugging Pass Rate
            </p>
            <p className="text-3xl font-bold" style={{ color: pctColor(question_type_accuracy.debugging) }}>
              {question_type_accuracy.debugging}%
            </p>
            {avg_time_per_question_type.debugging > 0 && (
              <p className="text-xs mt-2" style={{ color: 'rgb(var(--text-secondary))' }}>
                Avg {avg_time_per_question_type.debugging}s per question
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
