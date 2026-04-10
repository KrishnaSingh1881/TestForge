import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type?: 'warning' | 'error' | 'success';
  onDismiss: () => void;
}

export default function Toast({ message, type = 'warning', onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setVisible(true));
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  const colors = {
    warning: { bg: 'rgba(234,179,8,0.15)',  border: 'rgba(234,179,8,0.4)',  text: '#facc15', icon: '⚠️' },
    error:   { bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.4)',  text: '#f87171', icon: '🚫' },
    success: { bg: 'rgba(74,222,128,0.15)', border: 'rgba(74,222,128,0.4)', text: '#4ade80', icon: '✓'  },
  };
  const c = colors[type];

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium shadow-lg"
      style={{
        backgroundColor: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
        backdropFilter: 'blur(12px)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        maxWidth: 360,
      }}
    >
      <span>{c.icon}</span>
      <span>{message}</span>
      <button onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
        className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
    </div>
  );
}
