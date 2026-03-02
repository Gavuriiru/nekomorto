import type { CSSProperties } from "react";

export const dashboardMotionDurations = {
  enterMs: 560,
  revealMs: 420,
} as const;

export const dashboardMotionDelays = {
  headerDescriptionMs: 140,
  headerActionsMs: 160,
  headerMetaMs: 200,
  sectionLeadMs: 200,
  sectionStepMs: 40,
  sectionMetaMs: 40,
  itemStepMs: 40,
  itemMaxExtraMs: 200,
} as const;

type DashboardStaggerOptions = {
  baseMs?: number;
  stepMs?: number;
  maxExtraMs?: number;
};

export const dashboardAnimationDelay = (delayMs: number): CSSProperties => ({
  animationDelay: `${delayMs}ms`,
});

export const dashboardClampedStaggerMs = (index: number, baseMs = 0) =>
  baseMs +
  Math.min(index * dashboardMotionDelays.itemStepMs, dashboardMotionDelays.itemMaxExtraMs);

export const dashboardStaggerDelay = (
  index: number,
  options: DashboardStaggerOptions = {},
): CSSProperties => {
  const {
    baseMs = 0,
    stepMs = dashboardMotionDelays.itemStepMs,
    maxExtraMs = dashboardMotionDelays.itemMaxExtraMs,
  } = options;

  return dashboardAnimationDelay(baseMs + Math.min(index * stepMs, maxExtraMs));
};
