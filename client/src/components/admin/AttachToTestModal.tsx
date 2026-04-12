import { useEffect, useState } from 'react';
import api from '../../lib/axios';
import GlassSelect from './GlassSelect';

interface Test { id: string; title: string; status: string; }

interface Props {
  questionId: string;
  preselectedTestId?: string;
  onClose: () => void;
}

export default function AttachToTestModal({ questionId, preselectedTestId, onClose }: Props) {
  const [tests, setTests] = useState<Test[]>([]);
  const [testId, setTestId] = useState(preselectedTestId ?? '');
  const [unlockAt, setUnlockAt] = useState(0);
  const [order, setOrder] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get('/tests').then(r => setTests(r.data.tests ?? [])).catch(() => {});
  }, []);

  async function handleAttach(e: React.FormEvent) {
    e.preventDefault();
    if (!testId) { setError('Select a test'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post(`/questions/${questionId}/attach`, {
        test_id: testId,
        unlock_at_minutes: unlockAt,
        question_order: order,
      });
      setSuccess(true);
      setTimeout(onClose, 1000);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Failed to attach');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500';
  const inputStyle = {
    backgroundColor: 'rgba(255,255,255,0.07)',
    border: '1px solid var(--glass-border)',
    color: 'rgb(var(--text-primary))',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="glass w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
            Attach to Test
          </h3>
          <button onClick={onClose} className="text-xl leading-none" style={{ color: 'rgb(var(--text-secondary))' }}>×</button>
        </div>

        {success ? (
          <p className="text-sm text-green-400 text-center py-4">Question attached successfully.</p>
        ) : (
          <form onSubmit={handleAttach} className="space-y-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>Test</label>
              <GlassSelect 
                value={testId}
                onChange={setTestId}
                options={tests.map(t => ({
                  value: t.id,
                  label: `${t.title} (${t.status})`
                }))}
                placeholder="Select a test..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>
                  Unlock at (minutes)
                </label>
                <input type="number" min={0} value={unlockAt}
                  onChange={e => setUnlockAt(Number(e.target.value))}
                  className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>
                  Question Order
                </label>
                <input type="number" min={0} value={order}
                  onChange={e => setOrder(Number(e.target.value))}
                  className={inputCls} style={inputStyle} />
              </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={loading}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                style={{ backgroundColor: 'rgb(var(--accent))' }}>
                {loading ? 'Attaching...' : 'Attach Question'}
              </button>
              <button type="button" onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid var(--glass-border)', color: 'rgb(var(--text-secondary))' }}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
