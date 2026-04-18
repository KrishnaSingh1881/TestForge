import { FiActivity } from 'react-icons/fi';

interface OrbitalBufferProps {
  size?: number | string;
  className?: string;
  color?: string;
}

export default function OrbitalBuffer({ size = 24, className = '', color = 'currentColor' }: OrbitalBufferProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <FiActivity 
        size={size} 
        color={color}
        className="animate-spin opacity-80"
        style={{ 
          filter: 'drop-shadow(0 0 8px var(--accent-glow))'
        }}
      />
    </div>
  );
}
