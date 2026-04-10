interface Props { error?: string; onRetry?: () => void; }

export default function EvaluatingScreen({ error, onRetry }: Props) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(15,23,42,0.97)', backdropFilter: 'blur(20px)' }}>

      {/* Background glow */}
      <div className="pointer-events-none absolute w-96 h-96 rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgb(99 102 241), transparent 70%)' }} />

      <div className="relative text-center space-y-6 px-8">
        {error ? (
          <>
            <div className="text-5xl">⚠️</div>
            <div>
              <p className="text-lg font-semibold mb-2" style={{ color: 'rgb(var(--text-primary))' }}>
                Submission failed
              </p>
              <p className="text-sm mb-4" style={{ color: 'rgb(var(--text-secondary))' }}>{error}</p>
            </div>
            {onRetry && (
              <button onClick={onRetry}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: 'rgb(var(--accent))' }}>
                Retry
              </button>
            )}
          </>
        ) : (
          <>
            {/* Spinner rings */}
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20" />
              <div className="absolute inset-0 rounded-full border-4 border-t-indigo-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
              <div className="absolute inset-2 rounded-full border-4 border-t-transparent border-r-indigo-400/60 border-b-transparent border-l-transparent animate-spin"
                style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
              <div className="absolute inset-0 flex items-center justify-center text-xl">📝</div>
            </div>

            <div>
              <p className="text-xl font-bold mb-2" style={{ color: 'rgb(var(--text-primary))' }}>
                Evaluating your submission
              </p>
              <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                Running test cases and computing your score...
              </p>
            </div>

            {/* Animated dots */}
            <div className="flex justify-center gap-1.5">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: 'rgb(var(--accent))',
                    animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
              ))}
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
