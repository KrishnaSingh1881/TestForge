/**
 * Property 8: LockScreen is rendered if and only if `session === null`
 *
 * Renders OSShell with a mocked AuthContext, toggles session between null
 * and a valid session object, and asserts that LockScreen presence matches
 * `session === null`.
 *
 * Validates: Requirements 2.3, 2.5, 19.1
 */

import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createContext, useContext, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

// ── Stub ResizeObserver (not available in jsdom) ─────────────
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// ── Mock heavy child components ───────────────────────────────
vi.mock('./Desktop', () => ({ default: () => <div data-testid="desktop" /> }));
vi.mock('./MenuBar', () => ({ default: () => <div data-testid="menu-bar" /> }));
vi.mock('./Dock', () => ({ default: () => <div data-testid="dock" /> }));
vi.mock('./LockScreen', () => ({ default: () => <div data-testid="lock-screen" /> }));

// ── Mock useOSStore ───────────────────────────────────────────
vi.mock('./store/useOSStore', () => ({
  useOSStore: () => ({
    closeAll: vi.fn(),
    setResponsiveMode: vi.fn(),
  }),
}));

// ── Mock ThemeContext ─────────────────────────────────────────
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
}));

// ── Controllable AuthContext ──────────────────────────────────
interface AuthContextValue {
  session: Session | null;
  user: null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: false,
  signOut: async () => {},
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useContext(AuthContext),
}));

// ── Fake session object ───────────────────────────────────────
const fakeSession = { access_token: 'tok', user: { id: 'u1' } } as unknown as Session;

// ── Wrapper that lets tests control session ───────────────────
function TestWrapper({
  initialSession,
  children,
}: {
  initialSession: Session | null;
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(initialSession);
  return (
    <AuthContext.Provider value={{ session, user: null, loading: false, signOut: async () => {} }}>
      {/* Expose setter so tests can toggle session */}
      <button
        data-testid="set-session-null"
        onClick={() => setSession(null)}
        style={{ display: 'none' }}
      />
      <button
        data-testid="set-session-valid"
        onClick={() => setSession(fakeSession)}
        style={{ display: 'none' }}
      />
      {children}
    </AuthContext.Provider>
  );
}

import OSShell from './OSShell';

// ── Tests ─────────────────────────────────────────────────────
describe('OSShell — LockScreen visibility invariant (Property 8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders LockScreen when session is null', () => {
    render(
      <TestWrapper initialSession={null}>
        <OSShell />
      </TestWrapper>
    );

    expect(screen.getByTestId('lock-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('desktop')).not.toBeInTheDocument();
    expect(screen.queryByTestId('menu-bar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dock')).not.toBeInTheDocument();
  });

  it('does NOT render LockScreen when session is valid', () => {
    render(
      <TestWrapper initialSession={fakeSession}>
        <OSShell />
      </TestWrapper>
    );

    expect(screen.queryByTestId('lock-screen')).not.toBeInTheDocument();
    expect(screen.getByTestId('desktop')).toBeInTheDocument();
    expect(screen.getByTestId('menu-bar')).toBeInTheDocument();
    expect(screen.getByTestId('dock')).toBeInTheDocument();
  });

  it('shows LockScreen after session transitions from valid → null', async () => {
    render(
      <TestWrapper initialSession={fakeSession}>
        <OSShell />
      </TestWrapper>
    );

    // Initially authenticated — no LockScreen
    expect(screen.queryByTestId('lock-screen')).not.toBeInTheDocument();

    // Sign out: session → null
    await act(async () => {
      screen.getByTestId('set-session-null').click();
    });

    expect(screen.getByTestId('lock-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('desktop')).not.toBeInTheDocument();
  });

  it('hides LockScreen after session transitions from null → valid', async () => {
    render(
      <TestWrapper initialSession={null}>
        <OSShell />
      </TestWrapper>
    );

    // Initially unauthenticated — LockScreen visible
    expect(screen.getByTestId('lock-screen')).toBeInTheDocument();

    // Log in: session → valid
    await act(async () => {
      screen.getByTestId('set-session-valid').click();
    });

    expect(screen.queryByTestId('lock-screen')).not.toBeInTheDocument();
    expect(screen.getByTestId('desktop')).toBeInTheDocument();
  });

  it('invariant holds across multiple session toggles', async () => {
    render(
      <TestWrapper initialSession={null}>
        <OSShell />
      </TestWrapper>
    );

    const toggles: Array<{ session: Session | null; expectLock: boolean }> = [
      { session: fakeSession, expectLock: false },
      { session: null, expectLock: true },
      { session: fakeSession, expectLock: false },
      { session: null, expectLock: true },
    ];

    for (const { session, expectLock } of toggles) {
      await act(async () => {
        const btnId = session === null ? 'set-session-null' : 'set-session-valid';
        screen.getByTestId(btnId).click();
      });

      if (expectLock) {
        expect(screen.getByTestId('lock-screen')).toBeInTheDocument();
        expect(screen.queryByTestId('desktop')).not.toBeInTheDocument();
      } else {
        expect(screen.queryByTestId('lock-screen')).not.toBeInTheDocument();
        expect(screen.getByTestId('desktop')).toBeInTheDocument();
      }
    }
  });
});
