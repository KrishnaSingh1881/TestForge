import TrafficLights from './TrafficLights';

interface WindowTitleBarProps {
  windowId: string;
  title: string;
  isLocked: boolean;
  timerSlot?: React.ReactNode;
}

export default function WindowTitleBar({ windowId, title, isLocked, timerSlot }: WindowTitleBarProps) {
  return (
    <div
      className="app-window-titlebar flex items-center px-3 h-10 shrink-0 select-none"
      style={{ cursor: isLocked ? 'default' : 'move' }}
    >
      {/* Traffic lights — left */}
      <div className="flex items-center w-16 shrink-0">
        <TrafficLights windowId={windowId} isLocked={isLocked} />
      </div>

      {/* Title — center */}
      <div className="flex-1 text-center">
        <span className="text-xs font-medium truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {title}
        </span>
      </div>

      {/* Timer slot — right */}
      <div className="flex items-center justify-end w-16 shrink-0">
        {timerSlot}
      </div>
    </div>
  );
}
