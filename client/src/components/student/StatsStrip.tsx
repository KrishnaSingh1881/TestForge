interface Stat { label: string; value: string | number; sub?: string; color?: string; }

export default function StatsStrip({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((s, i) => (
        <div key={i} className="glass p-4 text-center">
          <p className="text-2xl font-bold" style={{ color: s.color ?? 'rgb(var(--accent))' }}>
            {s.value}
          </p>
          <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>{s.label}</p>
          {s.sub && <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-secondary))' }}>{s.sub}</p>}
        </div>
      ))}
    </div>
  );
}
