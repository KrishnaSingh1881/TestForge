import { useRef, useEffect, useState } from 'react';
import { motion, useTransform, MotionValue } from 'framer-motion';
import type { AppDefinition } from '../apps/registry';
import { registerDockIconRef } from '../AppWindow';
import { APP_ICONS } from './AppIcons';

interface DockIconProps {
  app: AppDefinition;
  isOpen: boolean;
  isActive: boolean;
  isMinimized: boolean;
  isLight: boolean;
  mouseX: MotionValue<number>;
  onClick: () => void;
}

export default function DockIcon({ app, isOpen, isActive, isMinimized, isLight, mouseX, onClick }: DockIconProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    registerDockIconRef(app.id, ref.current);
    return () => registerDockIconRef(app.id, null);
  }, [app.id]);

  const distance = useTransform(mouseX, (x: number) => {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds) return Infinity;
    return Math.abs(x - (bounds.left + bounds.width / 2));
  });

  const scale = useTransform(distance, [0, 70, 140], [1.4, 1.18, 1.0]);
  const y     = useTransform(distance, [0, 70, 140], [-10, -5, 0]);

  const IconComponent = APP_ICONS[app.id];

  // Theme-aware colors
  const tileBg = isLight
    ? isActive ? 'rgba(180, 130, 60, 0.45)' : 'rgba(200, 160, 90, 0.25)'
    : isActive ? 'rgba(130, 100, 220, 0.45)' : 'rgba(255, 255, 255, 0.08)';

  const tileBorder = isLight
    ? isActive ? '1px solid rgba(160, 110, 40, 0.6)' : '1px solid rgba(180, 140, 70, 0.3)'
    : isActive ? '1px solid rgba(180, 150, 255, 0.5)' : '1px solid rgba(255, 255, 255, 0.14)';

  const tileShadow = isLight
    ? isActive
      ? '0 0 16px rgba(160,110,30,0.35), inset 0 1px 0 rgba(255,220,120,0.3)'
      : '0 4px 14px rgba(100,60,10,0.2), inset 0 1px 0 rgba(255,220,120,0.1)'
    : isActive
      ? '0 0 18px rgba(130,90,255,0.45), inset 0 1px 0 rgba(255,255,255,0.15)'
      : '0 4px 14px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.07)';

  const tooltipBg = isLight ? 'rgba(60, 40, 10, 0.88)' : 'rgba(6, 4, 20, 0.92)';
  const dotColor  = isLight
    ? isActive ? 'rgba(140, 90, 20, 0.9)' : 'rgba(100, 70, 20, 0.5)'
    : isActive ? 'rgba(167,139,250,1)'     : 'rgba(255,255,255,0.45)';

  return (
    <div
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Tooltip */}
      <motion.div
        animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 4 }}
        transition={{ duration: 0.12 }}
        style={{
          position: 'absolute',
          bottom: 'calc(100% + 10px)',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '4px 12px',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          background: tooltipBg,
          color: '#fff',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)',
          pointerEvents: 'none',
          zIndex: 10,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}
      >
        {app.name}
      </motion.div>

      {/* Icon tile */}
      <motion.div
        ref={ref}
        style={{ scale, y }}
        onClick={onClick}
        whileTap={{ scale: 0.88 }}
        title={app.name}
      >
        <div style={{
          width: 58,
          height: 58,
          borderRadius: 15,
          overflow: 'hidden',
          cursor: 'pointer',
          userSelect: 'none',
          opacity: isMinimized ? 0.4 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: tileBg,
          backdropFilter: 'blur(16px) saturate(160%)',
          WebkitBackdropFilter: 'blur(16px) saturate(160%)',
          border: tileBorder,
          boxShadow: tileShadow,
          transition: 'background 0.8s ease, border 0.8s ease, box-shadow 0.8s ease, opacity 0.2s',
        }}>
          {IconComponent
            ? <IconComponent />
            : <span style={{ fontSize: 26 }}>{app.icon}</span>
          }
        </div>
      </motion.div>

      {/* Dot indicator */}
      <div style={{
        width: 4, height: 4, borderRadius: '50%',
        marginTop: 4,
        background: dotColor,
        opacity: isOpen ? 1 : 0,
        transition: 'opacity 0.2s, background 0.8s ease',
        boxShadow: isActive
          ? isLight ? '0 0 5px rgba(140,90,20,0.6)' : '0 0 6px rgba(167,139,250,0.9)'
          : 'none',
      }} />
    </div>
  );
}
