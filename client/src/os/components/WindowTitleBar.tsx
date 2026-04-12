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
      className="app-window-titlebar flex items-center px-4 h-12 shrink-0 select-none"
      style={{ cursor: isLocked ? 'default' : 'move' }}
    >
      {/* Traffic lights — left */}
      <div className="flex items-center w-20 shrink-0">
        <TrafficLights windowId={windowId} isLocked={isLocked} />
      </div>

      {/* Title — center */}
      <div className="flex-1 text-center">
        <span className="text-sm font-medium truncate text-primary opacity-60">
          {title}
        </span>
      </div>

      {/* Timer slot — right */}
      <div className="flex items-center justify-end w-20 shrink-0">
        {timerSlot}
      </div>
    </div>
  );
}
