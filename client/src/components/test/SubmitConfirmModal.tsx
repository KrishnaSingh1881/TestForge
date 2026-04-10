interface Props {
  answeredCount: number;
  totalCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function SubmitConfirmModal({ answeredCount, totalCount, onConfirm, onCancel }: Props) {
  const unanswered = totalCount - answeredCount;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
      <div className="glass w-full max-w-sm p-7 space-y-5"
        style={{ animation: 'fadeSlideUp 0.2s ease' }}>

        <div className="text-center">
          <div className="text-4xl mb-3">📋</div>
          <h2 className="text-lg font-bold mb-1" style={{ color: 'rgb(var(--text-primary))' }}>
            Submit Test?
          </h2>
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
            This cannot be undone. Your answers will be evaluated immediately.
          </p>
        </div>

        {/* Summary */}
        <div className="rounded-xl p-4 space-y-2"
          style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}>
          <div className="flex justify-between text-sm">
            <span style={{ color: 'rgb(var(--text-secondary))' }}>Answered</span>
            <span style={{ color: '#4ade80' }}>{answeredCount} / {totalCount}</span>
          </div>
          {unanswered > 0 && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'rgb(var(--text-secondary))' }}>Unanswered</span>
              <span style={{ color: '#f87171' }}>{unanswered}</span>
            </div>
          )}
        </div>

        {unanswered > 0 && (
          <p className="text-xs text-center" style={{ color: '#facc15' }}>
            ⚠ You have {unanswered} unanswered question{unanswered !== 1 ? 's' : ''}.
          </p>
        )}

        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'rgb(var(--accent))' }}>
            Submit Now
          </button>
        </div>
      </div>
    </div>
  );
}
