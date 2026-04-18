import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { AppDefinition } from '../apps/registry';
import { registerDockIconRef } from '../AppWindow';
import { APP_ICONS } from './AppIcons';
import BorderGlow from '../../components/BorderGlow';

interface DockIconProps {
  app: AppDefinition;
  isOpen: boolean;
  isActive: boolean;
  isMinimized: boolean;
  isLight: boolean;
  onClick: () => void;
}

export default function DockIcon({ app, isOpen, isActive, isMinimized, isLight, onClick }: DockIconProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    registerDockIconRef(app.id, ref.current);
    return () => registerDockIconRef(app.id, null);
  }, [app.id]);

  const IconComponent = APP_ICONS[app.id];

  // Liquid Glass tokens
  const tileBg = isLight
    ? isActive ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.12)'
    : isActive ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)';

  const tileBorder = isLight
    ? isActive ? '1px solid rgba(0, 0, 0, 0.1)' : '1px solid rgba(0, 0, 0, 0.05)'
    : isActive ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.06)';

  const tooltipBg = 'rgba(15, 12, 35, 0.8)';
  const dotColor  = isLight
    ? isActive ? '#6366f1' : 'rgba(0,0,0,0.2)'
    : isActive ? '#818cf8' : 'rgba(255,255,255,0.2)';

  return (
    <div
      className="flex flex-col items-center relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Tooltip - Modern Liquid Glass */}
      <motion.div
        animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 8, scale: hovered ? 1 : 0.9 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        style={{
          position: 'absolute',
          bottom: 'calc(100% + 16px)',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '6px 14px',
          borderRadius: 12,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          background: tooltipBg,
          color: '#fff',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.08)',
          pointerEvents: 'none',
          zIndex: 50,
          boxShadow: '0 10px 30px -5px rgba(0,0,0,0.5)',
        }}
      >
        {app.name}
      </motion.div>

      {/* Icon tile */}
      <motion.div
        ref={ref}
        onClick={onClick}
        whileHover={{ scale: 1.25, y: -10 }}
        whileTap={{ scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="relative"
      >
        <BorderGlow
            glowColor={isLight ? '40 50 80' : '230 80 60'}
            glowRadius={15}
            glowIntensity={isLight ? 0.25 : 0.4}
            borderRadius={14}
            backgroundColor={tileBg}
            className="no-shadow"
        >
            <div style={{
            width: 54,
            height: 54,
            borderRadius: 14,
            overflow: 'hidden',
            cursor: 'pointer',
            userSelect: 'none',
            opacity: isMinimized ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(24px) saturate(200%)',
            WebkitBackdropFilter: 'blur(24px) saturate(200%)',
            border: tileBorder,
            transition: 'background 0.6s ease, border 0.6s ease',
            }}
            >
            <div className="transform scale-[0.85] transition-transform duration-500 flex items-center justify-center w-full h-full">
                {IconComponent
                    ? <IconComponent />
                    : <span style={{ fontSize: 24 }}>{app.icon}</span>
                }
            </div>
            </div>
        </BorderGlow>
      </motion.div>

      {/* Dot indicator */}
      <motion.div 
        animate={{ 
          scale: isOpen ? 1 : 0,
          opacity: isOpen ? 1 : 0,
          y: isOpen ? 0 : 4
        }}
        style={{
          width: 4, height: 4, borderRadius: '50%',
          marginTop: 6,
          background: dotColor,
          boxShadow: isActive
            ? `0 0 10px ${dotColor}`
            : 'none',
        }} 
      />
    </div>
  );
}
