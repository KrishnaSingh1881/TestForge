import { describe, it, expect } from 'vitest';

/**
 * Tests for Terminal drag handle height clamping logic.
 *
 * The drag handle computes new terminal height as:
 *   newHeight = Math.max(100, Math.min(maxHeight, startHeight + delta))
 *
 * Where:
 *   - delta = startY - currentY  (drag up = positive delta = increase height)
 *   - min height = 100px
 *   - max height = 60% of window height (passed as maxHeight prop)
 *
 * We test the clamping math directly, mirroring the logic in Terminal.tsx.
 *
 * Validates: Requirements 11.5, 11.12
 */

/** Mirrors the clamping logic from Terminal.tsx drag handle */
function clampTerminalHeight(startHeight: number, delta: number, maxHeight: number): number {
  return Math.max(100, Math.min(maxHeight, startHeight + delta));
}

describe('Terminal drag handle — minimum height clamping', () => {
  /**
   * Validates: Requirements 11.5, 11.12
   * Spec: terminal height must not go below 100px
   */
  it('clamps to 100px when dragged below minimum', () => {
    // Start at 200px, drag down 150px (delta = -150)
    expect(clampTerminalHeight(200, -150, 600)).toBe(100);
  });

  it('clamps to 100px when result would be exactly 0', () => {
    expect(clampTerminalHeight(100, -100, 600)).toBe(100);
  });

  it('clamps to 100px when result would be negative', () => {
    expect(clampTerminalHeight(50, -200, 600)).toBe(100);
  });

  it('does not clamp when height stays above minimum', () => {
    // Start at 200px, drag down 50px → 150px (above min)
    expect(clampTerminalHeight(200, -50, 600)).toBe(150);
  });

  it('allows exactly 100px (boundary value)', () => {
    // Start at 200px, drag down exactly 100px → 100px
    expect(clampTerminalHeight(200, -100, 600)).toBe(100);
  });
});

describe('Terminal drag handle — maximum height clamping (60% of window height)', () => {
  /**
   * Validates: Requirements 11.5, 11.12
   * Spec: terminal height must not exceed 60% of window height
   */
  it('clamps to maxHeight when dragged above maximum', () => {
    const windowHeight = 800;
    const maxHeight = windowHeight * 0.6; // 480px
    // Start at 300px, drag up 300px → would be 600px, clamped to 480px
    expect(clampTerminalHeight(300, 300, maxHeight)).toBe(480);
  });

  it('clamps to maxHeight when result would exceed it', () => {
    const maxHeight = 480; // 60% of 800px window
    expect(clampTerminalHeight(400, 200, maxHeight)).toBe(480);
  });

  it('does not clamp when height stays below maximum', () => {
    const maxHeight = 480;
    // Start at 200px, drag up 100px → 300px (below max)
    expect(clampTerminalHeight(200, 100, maxHeight)).toBe(300);
  });

  it('allows exactly maxHeight (boundary value)', () => {
    const maxHeight = 480;
    // Start at 280px, drag up exactly 200px → 480px
    expect(clampTerminalHeight(280, 200, maxHeight)).toBe(480);
  });

  it('respects different window heights (maxHeight scales with window)', () => {
    // 1000px window → max 600px
    expect(clampTerminalHeight(400, 400, 600)).toBe(600);
    // 600px window → max 360px
    expect(clampTerminalHeight(200, 300, 360)).toBe(360);
  });
});

describe('Terminal drag handle — combined clamping', () => {
  it('applies min clamp when both bounds would be violated (min wins)', () => {
    // maxHeight < 100 is an edge case — min always wins
    expect(clampTerminalHeight(50, -100, 80)).toBe(100);
  });

  it('height within valid range passes through unchanged', () => {
    const maxHeight = 480;
    expect(clampTerminalHeight(200, 50, maxHeight)).toBe(250);
    expect(clampTerminalHeight(300, -80, maxHeight)).toBe(220);
  });
});
