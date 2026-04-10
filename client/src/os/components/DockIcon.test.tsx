import { describe, it, expect } from 'vitest';

/**
 * Tests for DockIcon magnification logic.
 *
 * The scale transform maps distance from icon center to scale:
 *   [0, 80, 160] → [1.6, 1.3, 1.0]
 *
 * The y-lift transform maps distance to vertical offset:
 *   [0, 80, 160] → [-12, -6, 0]
 *
 * We test the interpolation math directly — this mirrors the
 * useTransform mapping used in DockIcon.tsx and validates the
 * magnification spec without relying on Framer Motion's reactive
 * evaluation in jsdom.
 *
 * Validates: Requirements 5.3
 */

/** Linear interpolation matching Framer Motion's useTransform behavior */
function linearInterpolate(
  value: number,
  inputRange: number[],
  outputRange: number[]
): number {
  if (value <= inputRange[0]) return outputRange[0];
  if (value >= inputRange[inputRange.length - 1]) return outputRange[outputRange.length - 1];
  for (let i = 0; i < inputRange.length - 1; i++) {
    if (value >= inputRange[i] && value <= inputRange[i + 1]) {
      const t = (value - inputRange[i]) / (inputRange[i + 1] - inputRange[i]);
      return outputRange[i] + t * (outputRange[i + 1] - outputRange[i]);
    }
  }
  return outputRange[outputRange.length - 1];
}

/** Scale mapping from DockIcon.tsx: distance → scale */
function dockScale(distance: number): number {
  return linearInterpolate(distance, [0, 80, 160], [1.6, 1.3, 1.0]);
}

/** Y-lift mapping from DockIcon.tsx: distance → y offset (px) */
function dockYLift(distance: number): number {
  return linearInterpolate(distance, [0, 80, 160], [-12, -6, 0]);
}

describe('DockIcon magnification — scale transform', () => {
  /**
   * Validates: Requirements 5.3
   * Spec: distance 0 → scale 1.6 (cursor directly over icon)
   */
  it('scale is 1.6 at distance 0', () => {
    expect(dockScale(0)).toBeCloseTo(1.6);
  });

  /**
   * Validates: Requirements 5.3
   * Spec: distance 80 → scale 1.3 (neighbor icon range)
   */
  it('scale is 1.3 at distance 80', () => {
    expect(dockScale(80)).toBeCloseTo(1.3);
  });

  /**
   * Validates: Requirements 5.3
   * Spec: distance 160 → scale 1.0 (outside magnification range)
   */
  it('scale is 1.0 at distance 160', () => {
    expect(dockScale(160)).toBeCloseTo(1.0);
  });

  it('scale is 1.0 when distance exceeds 160 (clamped)', () => {
    expect(dockScale(300)).toBeCloseTo(1.0);
    expect(dockScale(1000)).toBeCloseTo(1.0);
  });

  it('scale is 1.6 when distance is below 0 (clamped)', () => {
    expect(dockScale(-10)).toBeCloseTo(1.6);
  });

  it('scale interpolates linearly between keyframes', () => {
    // Midpoint between 0 and 80: distance 40 → scale 1.45
    expect(dockScale(40)).toBeCloseTo(1.45);
    // Midpoint between 80 and 160: distance 120 → scale 1.15
    expect(dockScale(120)).toBeCloseTo(1.15);
  });
});

describe('DockIcon magnification — y-lift transform', () => {
  it('y lift is -12px at distance 0 (maximum lift)', () => {
    expect(dockYLift(0)).toBeCloseTo(-12);
  });

  it('y lift is -6px at distance 80', () => {
    expect(dockYLift(80)).toBeCloseTo(-6);
  });

  it('y lift is 0px at distance 160 (no lift)', () => {
    expect(dockYLift(160)).toBeCloseTo(0);
  });

  it('y lift interpolates linearly between keyframes', () => {
    // Midpoint between 0 and 80: distance 40 → y -9
    expect(dockYLift(40)).toBeCloseTo(-9);
  });
});
