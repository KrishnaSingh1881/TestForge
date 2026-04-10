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
      className="flex items-center gap-1.5"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Red — close */}
      <button
        className="traffic-light traffic-light-red flex items-center justify-center"
        onClick={(e) => { e.stopPropagation(); closeWindow(windowId); }}
        title="Close"
      >
        {hovered && <span className="text-[8px] font-bold leading-none" style={{ color: 'rgba(0,0,0,0.5)' }}>×</span>}
      </button>

      {/* Yellow — minimize */}
      <button
        className="traffic-light traffic-light-yellow flex items-center justify-center"
        onClick={(e) => { e.stopPropagation(); minimizeWindow(windowId); }}
        title="Minimize"
      >
        {hovered && <span className="text-[8px] font-bold leading-none" style={{ color: 'rgba(0,0,0,0.5)' }}>−</span>}
      </button>

      {/* Green — maximize / restore */}
      <button
        className="traffic-light traffic-light-green flex items-center justify-center"
        onClick={(e) => {
          e.stopPropagation();
          isMaximized ? unmaximizeWindow(windowId) : maximizeWindow(windowId);
        }}
        title={isMaximized ? 'Restore' : 'Maximize'}
      >
        {hovered && (
          <span className="text-[8px] font-bold leading-none" style={{ color: 'rgba(0,0,0,0.5)' }}>
            {isMaximized ? '⤡' : '+'}
          </span>
        )}
      </button>
    </div>
  );
}
