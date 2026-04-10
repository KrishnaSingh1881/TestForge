import { useRef } from 'react';
import { motion, useMotionValue, useTransform, MotionValue } from 'framer-motion';
import type { AppDefinition } from '../apps/registry';

interface DockIconProps {
  app: AppDefinition;
  isOpen: boolean;
  isMinimized: boolean;
  mouseX: MotionValue<number>;
  onClick: () => void;
}

export default function DockIcon({ app, isOpen, isMinimized, mouseX, onClick }: DockIconProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Distance-based magnification
  const distance = useTransform(mouseX, (x: number) => {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds) return Infinity;
    return Math.abs(x - (bounds.left + bounds.width / 2));
  });

  const scale = useTransform(distance, [0, 80, 160], [1.6, 1.3, 1.0]);
  const y     = useTransform(distance, [0, 80, 160], [-12, -6, 0]);

  return (
    <div className="relative flex flex-col items-center" style={{ width: 56 }}>
      {/* Tooltip */}
      <motion.div
        className="absolute -top-8 px-2 py-1 rounded text-xs font-medium pointer-events-none whitespace-nowrap"
        style={{
          backgroundColor: 'rgba(0,0,0,0.75)',
          color: '#fff',
          opacity: 0,
        }}
        whileHover={{ opacity: 1 }}
      >
        {app.name}
      </motion.div>

      {/* Icon */}
      <motion.div
        ref={ref}
        style={{ scale, y }}
        onClick={onClick}
        className="flex items-center justify-center rounded-2xl cursor-pointer select-none"
        style={{
          width: 48,
          height: 48,
          fontSize: 28,
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.15)',
          opacity: isMinimized ? 0.5 : 1,
        }}
        whileTap={{ scale: 0.9 }}
        title={app.name}
      >
        {app.icon}
      </motion.div>

      {/* Open indicator dot */}
      <div
        className="dock-indicator mt-1"
        style={{ opacity: isOpen ? 1 : 0, transition: 'opacity 0.2s' }}
      />
    </div>
  );
}
