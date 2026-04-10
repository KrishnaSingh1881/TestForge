import type { AppType } from '../store/useOSStore';

export interface AppDefinition {
  id: AppType;
  name: string;
  icon: string;
  defaultSize: { width: number; height: number };
  defaultPosition: { x: number; y: number };
  allowedRoles: Array<'student' | 'admin' | 'super_admin'>;
  singleton: boolean;
}

export const APP_REGISTRY: AppDefinition[] = [
  // ── Student apps ──────────────────────────────────────────
  {
    id: 'tests',
    name: 'Tests',
    icon: '📋',
    defaultSize: { width: 760, height: 560 },
    defaultPosition: { x: 80, y: 60 },
    allowedRoles: ['student'],
    singleton: true,
  },
  {
    id: 'test-session',
    name: 'Test Session',
    icon: '⌨️',
    defaultSize: { width: 1100, height: 720 },
    defaultPosition: { x: 60, y: 40 },
    allowedRoles: ['student'],
    singleton: false,
  },
  {
    id: 'results',
    name: 'Results',
    icon: '📊',
    defaultSize: { width: 800, height: 600 },
    defaultPosition: { x: 100, y: 80 },
    allowedRoles: ['student', 'admin', 'super_admin'],
    singleton: false,
  },
  {
    id: 'analytics',
    name: 'Analytics',
    icon: '📈',
    defaultSize: { width: 900, height: 640 },
    defaultPosition: { x: 120, y: 70 },
    allowedRoles: ['student'],
    singleton: true,
  },
  // ── Admin apps ────────────────────────────────────────────
  {
    id: 'question-bank',
    name: 'Question Bank',
    icon: '🗃️',
    defaultSize: { width: 1000, height: 680 },
    defaultPosition: { x: 80, y: 50 },
    allowedRoles: ['admin', 'super_admin'],
    singleton: true,
  },
  {
    id: 'test-manager',
    name: 'Test Manager',
    icon: '🗓️',
    defaultSize: { width: 960, height: 660 },
    defaultPosition: { x: 100, y: 60 },
    allowedRoles: ['admin', 'super_admin'],
    singleton: true,
  },
  {
    id: 'integrity',
    name: 'Integrity',
    icon: '🔍',
    defaultSize: { width: 1000, height: 680 },
    defaultPosition: { x: 90, y: 55 },
    allowedRoles: ['admin', 'super_admin'],
    singleton: false,
  },
  {
    id: 'admin-analytics',
    name: 'Analytics',
    icon: '📈',
    defaultSize: { width: 960, height: 660 },
    defaultPosition: { x: 110, y: 65 },
    allowedRoles: ['admin', 'super_admin'],
    singleton: true,
  },
];

/** Returns apps visible in the Dock for a given role */
export function getAppsForRole(
  role: 'student' | 'admin' | 'super_admin'
): AppDefinition[] {
  // test-session is never shown in the dock (opened programmatically)
  return APP_REGISTRY.filter(
    app => app.allowedRoles.includes(role) && app.id !== 'test-session'
  );
}

/** Look up a single app definition by id */
export function getAppById(id: AppType): AppDefinition | undefined {
  return APP_REGISTRY.find(app => app.id === id);
}
