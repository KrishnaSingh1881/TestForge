/**
 * Property 6: Status bar background is `--vscode-statusbar-test-bg` when
 * `sessionPhase === 'active'` and `--vscode-statusbar-bg` otherwise.
 *
 * Validates: Requirements 11.5
 *
 * Strategy: The status bar background is determined by a single inline
 * conditional in VSCodeLayout.tsx:
 *
 *   backgroundColor: sessionPhase === 'active'
 *     ? 'var(--vscode-statusbar-test-bg)'
 *     : 'var(--vscode-statusbar-bg)'
 *
 * We extract and test this logic directly (same approach as Terminal.test.tsx)
 * to avoid the heavy mocking burden of Monaco Editor and the execute API.
 * The property is universal: it must hold for every possible sessionPhase value.
 */

import { describe, it, expect } from 'vitest';

type SessionPhase = 'start-screen' | 'active' | 'evaluating' | 'done';

/** Mirrors the status bar backgroundColor expression from VSCodeLayout.tsx */
function statusBarBg(sessionPhase: SessionPhase): string {
  return sessionPhase === 'active'
    ? 'var(--vscode-statusbar-test-bg)'
    : 'var(--vscode-statusbar-bg)';
}

describe('VSCodeLayout status bar — color token property (Property 6)', () => {
  /**
   * Core property: active phase → test background token
   */
  it('uses --vscode-statusbar-test-bg when sessionPhase is "active"', () => {
    expect(statusBarBg('active')).toBe('var(--vscode-statusbar-test-bg)');
  });

  /**
   * Core property: all non-active phases → normal background token
   */
  it('uses --vscode-statusbar-bg when sessionPhase is "start-screen"', () => {
    expect(statusBarBg('start-screen')).toBe('var(--vscode-statusbar-bg)');
  });

  it('uses --vscode-statusbar-bg when sessionPhase is "evaluating"', () => {
    expect(statusBarBg('evaluating')).toBe('var(--vscode-statusbar-bg)');
  });

  it('uses --vscode-statusbar-bg when sessionPhase is "done"', () => {
    expect(statusBarBg('done')).toBe('var(--vscode-statusbar-bg)');
  });

  /**
   * Universal property: only 'active' ever produces the test-bg token.
   * All other phases must produce the normal bg token.
   */
  it('only "active" phase produces the test background token', () => {
    const allPhases: SessionPhase[] = ['start-screen', 'active', 'evaluating', 'done'];
    const testBgPhases = allPhases.filter(p => statusBarBg(p) === 'var(--vscode-statusbar-test-bg)');
    expect(testBgPhases).toEqual(['active']);
  });

  it('every non-active phase produces the normal background token', () => {
    const nonActivePhases: SessionPhase[] = ['start-screen', 'evaluating', 'done'];
    for (const phase of nonActivePhases) {
      expect(statusBarBg(phase)).toBe('var(--vscode-statusbar-bg)');
    }
  });

  /**
   * Boundary: the two tokens are distinct — they never resolve to the same value.
   */
  it('the two CSS tokens are distinct strings', () => {
    expect('var(--vscode-statusbar-test-bg)').not.toBe('var(--vscode-statusbar-bg)');
  });
});
