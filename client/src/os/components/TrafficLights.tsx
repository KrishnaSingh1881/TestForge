import { useState } from 'react';
import { useOSStore } from '../store/useOSStore';

interface TrafficLightsProps {
  windowId: string;
  isLocked: boolean;
}

export default function TrafficLights({ windowId, isLocked }: TrafficLightsProps) {
  const [hovered, setHovered] = useState(false);
  const { closeWindow, minimizeWindow, maximizeWindow, unmaximizeWindow, windows } = useOSStore();

  const win = windows.find(w => w.id === windowId);
  const isMaximized = win?.isMaximized ?? false;

  if (isLocked) {
    return (
      <div className="flex items-center justify-center w-8 h-5">
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>🔒</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Red — close */}
      <button
        className="traffic-light traffic-light-red flex items-center justify-center"
        onClick={(e) => { e.stopPropagation(); closeWindow(windowId); }}
        title="Close"
        aria-label="Close window"
      >
        {hovered && <span className="text-[9px] font-bold leading-none" style={{ color: 'rgba(0,0,0,0.55)' }}>×</span>}
      </button>

      {/* Yellow — minimize */}
      <button
        className="traffic-light traffic-light-yellow flex items-center justify-center"
        onClick={(e) => { e.stopPropagation(); minimizeWindow(windowId); }}
        title="Minimize"
        aria-label="Minimize window"
      >
        {hovered && <span className="text-[9px] font-bold leading-none" style={{ color: 'rgba(0,0,0,0.55)' }}>−</span>}
      </button>

      {/* Green — maximize / restore */}
      <button
        className="traffic-light traffic-light-green flex items-center justify-center"
        onClick={(e) => {
          e.stopPropagation();
          isMaximized ? unmaximizeWindow(windowId) : maximizeWindow(windowId);
        }}
        title={isMaximized ? 'Restore' : 'Maximize'}
        aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
      >
        {hovered && (
          <span className="text-[9px] font-bold leading-none" style={{ color: 'rgba(0,0,0,0.55)' }}>
            {isMaximized ? '⤡' : '+'}
          </span>
        )}
      </button>
    </div>
  );
}
