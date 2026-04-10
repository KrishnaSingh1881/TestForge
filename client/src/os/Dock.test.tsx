/**
 * Property 3: Only apps whose `allowedRoles` includes `user.role` are rendered in the Dock.
 *
 * - Render Dock with student role; assert no admin-only app icons are present.
 * - Render Dock with admin role; assert no student-only app icons are present.
 *
 * Uses `getAppsForRole` to derive expected/unexpected app names dynamically,
 * making this a true property test rather than hardcoded assertions.
 *
 * Validates: Requirements 5.2, 19.2
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createContext, useContext } from 'react';

// ── Stub ResizeObserver (not available in jsdom) ──────────────
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// ── Mock framer-motion to avoid animation issues in jsdom ─────
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
    nav: ({ children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) => (
      <nav {...props}>{children}</nav>
    ),
  },
  useMotionValue: () => ({ set: vi.fn(), get: vi.fn(() => Infinity) }),
  useTransform: (_mv: unknown, _input: unknown, output: number[]) => ({
    get: () => output[output.length - 1],
  }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── Mock DockIcon to render a testid based on app.id ─────────
vi.mock('./components/DockIcon', () => ({
  default: ({ app }: { app: { id: string; name: string } }) => (
    <div data-testid={`dock-icon-${app.id}`} title={app.name} />
  ),
}));

// ── Mock useOSStore ───────────────────────────────────────────
vi.mock('./store/useOSStore', () => ({
  useOSStore: () => ({
    windows: [],
    openWindow: vi.fn(),
    focusWindow: vi.fn(),
    restoreWindow: vi.fn(),
    responsiveMode: 'desktop',
  }),
}));

// ── Controllable AuthContext ──────────────────────────────────
interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'admin' | 'super_admin';
}

interface AuthContextValue {
  session: null;
  user: UserProfile | null;
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

// ── Import after mocks ────────────────────────────────────────
import Dock from './Dock';
import { getAppsForRole, APP_REGISTRY } from './apps/registry';

// ── Helpers ───────────────────────────────────────────────────
function renderDockWithRole(role: 'student' | 'admin' | 'super_admin') {
  const user: UserProfile = {
    id: 'u1',
    name: 'Test User',
    email: 'test@example.com',
    role,
  };
  return render(
    <AuthContext.Provider value={{ session: null, user, loading: false, signOut: async () => {} }}>
      <Dock />
    </AuthContext.Provider>
  );
}

// ── Tests ─────────────────────────────────────────────────────
describe('Dock — role-gated icon rendering (Property 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Validates: Requirements 5.2, 19.2
   * Student role: only student-allowed apps should appear; admin-only apps must not.
   */
  it('renders only student-allowed apps for student role', () => {
    renderDockWithRole('student');

    const studentApps = getAppsForRole('student');
    const adminOnlyApps = APP_REGISTRY.filter(
      app =>
        !app.allowedRoles.includes('student') &&
        app.id !== 'test-session' // test-session is never in dock
    );

    // All student apps should be present (by data-testid using app.id)
    for (const app of studentApps) {
      expect(screen.getByTestId(`dock-icon-${app.id}`)).toBeInTheDocument();
    }

    // Admin-only apps must NOT be present
    for (const app of adminOnlyApps) {
      expect(screen.queryByTestId(`dock-icon-${app.id}`)).not.toBeInTheDocument();
    }
  });

  /**
   * Validates: Requirements 5.2, 19.2
   * Admin role: only admin-allowed apps should appear; student-only apps must not.
   */
  it('renders only admin-allowed apps for admin role', () => {
    renderDockWithRole('admin');

    const adminApps = getAppsForRole('admin');
    const studentOnlyApps = APP_REGISTRY.filter(
      app =>
        !app.allowedRoles.includes('admin') &&
        app.id !== 'test-session' // test-session is never in dock
    );

    // All admin apps should be present
    for (const app of adminApps) {
      expect(screen.getByTestId(`dock-icon-${app.id}`)).toBeInTheDocument();
    }

    // Student-only apps must NOT be present
    for (const app of studentOnlyApps) {
      expect(screen.queryByTestId(`dock-icon-${app.id}`)).not.toBeInTheDocument();
    }
  });

  /**
   * Validates: Requirements 5.2, 19.2
   * Property: the set of rendered dock icons exactly matches getAppsForRole(role).
   * Verified for both student and admin roles.
   */
  it('rendered dock icons exactly match getAppsForRole output for student', () => {
    renderDockWithRole('student');

    const expectedApps = getAppsForRole('student');

    // Every expected app icon is present
    for (const app of expectedApps) {
      expect(screen.getByTestId(`dock-icon-${app.id}`)).toBeInTheDocument();
    }

    // No unexpected app icons from the full registry appear
    const unexpectedApps = APP_REGISTRY.filter(
      app => !app.allowedRoles.includes('student') && app.id !== 'test-session'
    );
    for (const app of unexpectedApps) {
      expect(screen.queryByTestId(`dock-icon-${app.id}`)).not.toBeInTheDocument();
    }
  });

  it('rendered dock icons exactly match getAppsForRole output for admin', () => {
    renderDockWithRole('admin');

    const expectedApps = getAppsForRole('admin');

    for (const app of expectedApps) {
      expect(screen.getByTestId(`dock-icon-${app.id}`)).toBeInTheDocument();
    }

    const unexpectedApps = APP_REGISTRY.filter(
      app => !app.allowedRoles.includes('admin') && app.id !== 'test-session'
    );
    for (const app of unexpectedApps) {
      expect(screen.queryByTestId(`dock-icon-${app.id}`)).not.toBeInTheDocument();
    }
  });

  /**
   * Validates: Requirements 5.2, 19.2
   * Specific named admin-only apps must not appear for student role.
   */
  it('student role: admin-only apps (question-bank, test-manager, integrity, admin-analytics) are absent', () => {
    renderDockWithRole('student');

    const adminOnlyIds = ['question-bank', 'test-manager', 'integrity', 'admin-analytics'];
    for (const id of adminOnlyIds) {
      expect(screen.queryByTestId(`dock-icon-${id}`)).not.toBeInTheDocument();
    }
  });

  /**
   * Validates: Requirements 5.2, 19.2
   * Specific named student-only apps must not appear for admin role.
   */
  it('admin role: student-only apps (tests, analytics) are absent', () => {
    renderDockWithRole('admin');

    // 'tests' and 'analytics' are student-only (not in admin allowedRoles)
    const studentOnlyIds = ['tests', 'analytics'];
    for (const id of studentOnlyIds) {
      expect(screen.queryByTestId(`dock-icon-${id}`)).not.toBeInTheDocument();
    }
  });
});
