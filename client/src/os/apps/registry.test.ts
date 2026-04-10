import { describe, it, expect } from 'vitest';
import { getAppsForRole, APP_REGISTRY } from './registry';

describe('App Registry Role Filtering', () => {
  describe('getAppsForRole("student")', () => {
    it('returns only student apps (tests, results, analytics)', () => {
      const studentApps = getAppsForRole('student');
      const appIds = studentApps.map(app => app.id);

      // Should include student-only apps
      expect(appIds).toContain('tests');
      expect(appIds).toContain('analytics');
      expect(appIds).toContain('results');

      // Should NOT include test-session (never shown in dock)
      expect(appIds).not.toContain('test-session');

      // Should NOT include admin apps
      expect(appIds).not.toContain('question-bank');
      expect(appIds).not.toContain('test-manager');
      expect(appIds).not.toContain('integrity');
      expect(appIds).not.toContain('admin-analytics');

      // Verify exact count (3 apps: tests, results, analytics)
      expect(studentApps).toHaveLength(3);
    });

    it('all returned apps have "student" in allowedRoles', () => {
      const studentApps = getAppsForRole('student');

      studentApps.forEach(app => {
        expect(app.allowedRoles).toContain('student');
      });
    });
  });

  describe('getAppsForRole("admin")', () => {
    it('returns only admin apps (question-bank, test-manager, integrity, admin-analytics) plus results', () => {
      const adminApps = getAppsForRole('admin');
      const appIds = adminApps.map(app => app.id);

      // Should include admin-only apps
      expect(appIds).toContain('question-bank');
      expect(appIds).toContain('test-manager');
      expect(appIds).toContain('integrity');
      expect(appIds).toContain('admin-analytics');

      // Should include results (shared with students)
      expect(appIds).toContain('results');

      // Should NOT include student-only apps
      expect(appIds).not.toContain('tests');
      expect(appIds).not.toContain('analytics');

      // Should NOT include test-session (never shown in dock)
      expect(appIds).not.toContain('test-session');

      // Verify exact count (5 apps: question-bank, test-manager, integrity, admin-analytics, results)
      expect(adminApps).toHaveLength(5);
    });

    it('all returned apps have "admin" in allowedRoles', () => {
      const adminApps = getAppsForRole('admin');

      adminApps.forEach(app => {
        expect(app.allowedRoles).toContain('admin');
      });
    });
  });

  describe('getAppsForRole("super_admin")', () => {
    it('returns the same apps as admin role', () => {
      const superAdminApps = getAppsForRole('super_admin');
      const adminApps = getAppsForRole('admin');

      expect(superAdminApps.map(a => a.id).sort()).toEqual(
        adminApps.map(a => a.id).sort()
      );
    });

    it('all returned apps have "super_admin" in allowedRoles', () => {
      const superAdminApps = getAppsForRole('super_admin');

      superAdminApps.forEach(app => {
        expect(app.allowedRoles).toContain('super_admin');
      });
    });
  });

  describe('test-session exclusion', () => {
    it('test-session is never returned by getAppsForRole for any role', () => {
      const studentApps = getAppsForRole('student');
      const adminApps = getAppsForRole('admin');
      const superAdminApps = getAppsForRole('super_admin');

      expect(studentApps.map(a => a.id)).not.toContain('test-session');
      expect(adminApps.map(a => a.id)).not.toContain('test-session');
      expect(superAdminApps.map(a => a.id)).not.toContain('test-session');
    });

    it('test-session exists in APP_REGISTRY but is filtered out', () => {
      const testSessionApp = APP_REGISTRY.find(app => app.id === 'test-session');
      expect(testSessionApp).toBeDefined();
      expect(testSessionApp?.allowedRoles).toContain('student');
    });
  });

  describe('role isolation', () => {
    it('student role cannot access admin-only apps', () => {
      const studentApps = getAppsForRole('student');
      const adminOnlyIds = ['question-bank', 'test-manager', 'integrity', 'admin-analytics'];

      adminOnlyIds.forEach(adminAppId => {
        expect(studentApps.map(a => a.id)).not.toContain(adminAppId);
      });
    });

    it('admin role cannot access student-only apps', () => {
      const adminApps = getAppsForRole('admin');
      const studentOnlyIds = ['tests', 'analytics'];

      studentOnlyIds.forEach(studentAppId => {
        expect(adminApps.map(a => a.id)).not.toContain(studentAppId);
      });
    });
  });
});
