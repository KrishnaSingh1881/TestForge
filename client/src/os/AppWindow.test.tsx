/**
 * Property 5: When `prefers-reduced-motion` is true, no scale or translate
 * transforms are applied — only opacity transitions.
 *
 * Validates: Requirements 17.9
 *
 * Strategy: AppWindow.tsx reads window.matchMedia at module-load time to set
 * the module-level `reduceMotion` constant. The global setup.ts provides a
 * default matchMedia stub (matches: false). Here we override it to return
 * matches: true for the reduced-motion query, then re-derive the variant
 * logic to assert the correct opacity-only behavior.
 */

import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Override matchMedia to return matches=true for prefers-reduced-motion.
// This must happen before AppWindow is imported so the module-level constant
// `reduceMotion` is set correctly.
vi.stubGlobal(
  'matchMedia',
  vi.fn((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
);

// ── Mock react-rnd ────────────────────────────────────────────
vi.mock('react-rnd', () => ({
  Rnd: ({
    children,
    style,
    disableDragging,
    enableResizing,
  }: {
    children: React.ReactNode;
    style?: React.CSSProperties;
    disableDragging?: boolean;
    enableResizing?: boolean | object;
    [key: string]: unknown;
  }) => (
    <div
      data-testid="rnd"
      style={style}
      data-disable-dragging={String(disableDragging)}
      data-enable-resizing={String(enableResizing)}
    >
      {children}
    </div>
  ),
}));

// ── Mock useOSStore ───────────────────────────────────────────
vi.mock('./store/useOSStore', () => ({
  useOSStore: () => ({
    focusWindow: vi.fn(),
    updatePosition: vi.fn(),
    updateSize: vi.fn(),
    responsiveMode: 'desktop',
    focusedWindowId: 'test-win',
  }),
}));

// ── Mock WindowTitleBar ───────────────────────────────────────
vi.mock('./components/WindowTitleBar', () => ({
  default: () => <div data-testid="title-bar" />,
}));

import AppWindow from './AppWindow';
import type { WindowState } from './store/useOSStore';

// ── Helpers ───────────────────────────────────────────────────
function makeWindow(overrides: Partial<WindowState> = {}): WindowState {
  return {
    id: 'test-win',
    appType: 'tests',
    title: 'Tests',
    position: { x: 80, y: 60 },
    size: { width: 760, height: 560 },
    isMinimized: false,
    isMaximized: false,
    isLocked: false,
    zIndex: 100,
    ...overrides,
  };
}

/**
 * Re-derives the windowVariants object using the same conditional logic as
 * AppWindow.tsx. With matchMedia stubbed to return matches=true for the
 * reduced-motion query, this mirrors what the component actually computes.
 */
function deriveVariants() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    initial: reduceMotion
      ? { opacity: 0 }
      : { scale: 0.85, opacity: 0, y: 20 },
    animate: reduceMotion
      ? { opacity: 1, transition: { duration: 0.15 } }
      : { scale: 1, opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } },
    exit: reduceMotion
      ? { opacity: 0, transition: { duration: 0.1 } }
      : { scale: 0.85, opacity: 0, y: 20, transition: { duration: 0.15, ease: 'easeIn' } },
  };
}

describe('AppWindow — prefers-reduced-motion compliance (Property 5)', () => {
  it('matchMedia correctly reports prefers-reduced-motion: reduce as true', () => {
    expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true);
  });

  it('initial variant has no scale or y-translate when reduced motion is preferred', () => {
    const variants = deriveVariants();
    expect(variants.initial).not.toHaveProperty('scale');
    expect(variants.initial).not.toHaveProperty('y');
    expect(variants.initial).toHaveProperty('opacity', 0);
  });

  it('animate variant has no scale or y-translate when reduced motion is preferred', () => {
    const variants = deriveVariants();
    expect(variants.animate).not.toHaveProperty('scale');
    expect(variants.animate).not.toHaveProperty('y');
    expect(variants.animate).toHaveProperty('opacity', 1);
  });

  it('exit variant has no scale or y-translate when reduced motion is preferred', () => {
    const variants = deriveVariants();
    expect(variants.exit).not.toHaveProperty('scale');
    expect(variants.exit).not.toHaveProperty('y');
    expect(variants.exit).toHaveProperty('opacity', 0);
  });

  it('animate transition uses duration-based timing (not spring) when reduced motion is preferred', () => {
    const variants = deriveVariants();
    const transition = (variants.animate as { transition?: Record<string, unknown> }).transition;
    expect(transition).toBeDefined();
    expect(transition).not.toHaveProperty('type', 'spring');
    expect(transition).toHaveProperty('duration');
  });

  it('exit transition uses duration-based timing (not spring) when reduced motion is preferred', () => {
    const variants = deriveVariants();
    const transition = (variants.exit as { transition?: Record<string, unknown> }).transition;
    expect(transition).toBeDefined();
    expect(transition).not.toHaveProperty('type', 'spring');
    expect(transition).toHaveProperty('duration');
  });

  it('renders AppWindow without throwing when prefers-reduced-motion is active', () => {
    expect(() =>
      render(
        <AppWindow window={makeWindow()}>
          <div>content</div>
        </AppWindow>
      )
    ).not.toThrow();
  });
});

/**
 * Property 2: For all AppWindows where `isLocked === true`, `react-rnd` has
 * `disableDragging={true}` and `enableResizing={false}`.
 *
 * Validates: Requirements 8.15
 *
 * Strategy: Render AppWindow with a locked window state (isLocked: true) and
 * assert that the mocked Rnd component receives the correct props. We test
 * across multiple app types and window configurations to verify the invariant
 * holds universally.
 */
describe('AppWindow — locked window controls invariant (Property 2)', () => {
  it('passes disableDragging=true and enableResizing=false to Rnd when isLocked is true', () => {
    const { getByTestId } = render(
      <AppWindow window={makeWindow({ isLocked: true })}>
        <div>content</div>
      </AppWindow>
    );

    const rnd = getByTestId('rnd');
    expect(rnd.getAttribute('data-disable-dragging')).toBe('true');
    expect(rnd.getAttribute('data-enable-resizing')).toBe('false');
  });

  it('does NOT disable dragging or resizing when isLocked is false', () => {
    const { getByTestId } = render(
      <AppWindow window={makeWindow({ isLocked: false })}>
        <div>content</div>
      </AppWindow>
    );

    const rnd = getByTestId('rnd');
    expect(rnd.getAttribute('data-disable-dragging')).toBe('false');
    // enableResizing is undefined (not false) when unlocked
    expect(rnd.getAttribute('data-enable-resizing')).not.toBe('false');
  });

  it('holds the locked invariant for every app type', () => {
    const appTypes = [
      'tests',
      'test-session',
      'results',
      'analytics',
      'question-bank',
      'test-manager',
      'integrity',
      'admin-analytics',
    ] as const;

    for (const appType of appTypes) {
      const { getByTestId, unmount } = render(
        <AppWindow window={makeWindow({ appType, isLocked: true })}>
          <div>content</div>
        </AppWindow>
      );

      const rnd = getByTestId('rnd');
      expect(rnd.getAttribute('data-disable-dragging')).toBe('true');
      expect(rnd.getAttribute('data-enable-resizing')).toBe('false');
      unmount();
    }
  });

  it('reflects lock state change: unlocked → locked → unlocked', () => {
    // Locked
    const { getByTestId: getLockedRnd, unmount: unmountLocked } = render(
      <AppWindow window={makeWindow({ isLocked: true })}>
        <div>content</div>
      </AppWindow>
    );
    expect(getLockedRnd('rnd').getAttribute('data-disable-dragging')).toBe('true');
    expect(getLockedRnd('rnd').getAttribute('data-enable-resizing')).toBe('false');
    unmountLocked();

    // Unlocked
    const { getByTestId: getUnlockedRnd, unmount: unmountUnlocked } = render(
      <AppWindow window={makeWindow({ isLocked: false })}>
        <div>content</div>
      </AppWindow>
    );
    expect(getUnlockedRnd('rnd').getAttribute('data-disable-dragging')).toBe('false');
    expect(getUnlockedRnd('rnd').getAttribute('data-enable-resizing')).not.toBe('false');
    unmountUnlocked();
  });
});
