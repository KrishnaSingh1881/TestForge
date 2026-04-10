import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TrafficLights from './TrafficLights';

// Mock useOSStore
vi.mock('../store/useOSStore', () => ({
  useOSStore: () => ({
    closeWindow: vi.fn(),
    minimizeWindow: vi.fn(),
    maximizeWindow: vi.fn(),
    unmaximizeWindow: vi.fn(),
    windows: [{ id: 'test-window', isMaximized: false }],
  }),
}));

describe('TrafficLights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Validates: Requirements 4.5
   */
  it('renders a lock icon when isLocked=true', () => {
    render(<TrafficLights windowId="test-window" isLocked={true} />);
    expect(screen.getByText('🔒')).toBeInTheDocument();
  });

  /**
   * Validates: Requirements 4.5
   */
  it('does not render traffic light circles when isLocked=true', () => {
    render(<TrafficLights windowId="test-window" isLocked={true} />);
    expect(screen.queryByTitle('Close')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Minimize')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Maximize')).not.toBeInTheDocument();
  });

  /**
   * Validates: Requirements 8.15
   */
  it('renders three traffic light circles when isLocked=false', () => {
    render(<TrafficLights windowId="test-window" isLocked={false} />);
    expect(screen.getByTitle('Close')).toBeInTheDocument();
    expect(screen.getByTitle('Minimize')).toBeInTheDocument();
    expect(screen.getByTitle('Maximize')).toBeInTheDocument();
  });

  /**
   * Validates: Requirements 8.15
   */
  it('does not render a lock icon when isLocked=false', () => {
    render(<TrafficLights windowId="test-window" isLocked={false} />);
    expect(screen.queryByText('🔒')).not.toBeInTheDocument();
  });
});
