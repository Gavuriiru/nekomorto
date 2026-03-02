import { describe, expect, it } from "vitest";

import {
  dashboardAnimationDelay,
  dashboardClampedStaggerMs,
  dashboardMotionDelays,
  dashboardMotionDurations,
  dashboardStaggerDelay,
} from "@/components/dashboard/dashboard-motion";

describe("dashboard-motion", () => {
  it("exports the shared dashboard motion spec", () => {
    expect(dashboardMotionDurations).toEqual({
      enterMs: 560,
      revealMs: 420,
    });
    expect(dashboardMotionDelays).toMatchObject({
      headerDescriptionMs: 140,
      headerActionsMs: 160,
      headerMetaMs: 200,
      sectionLeadMs: 200,
      sectionStepMs: 40,
      sectionMetaMs: 40,
      itemStepMs: 40,
      itemMaxExtraMs: 200,
    });
  });

  it("builds animationDelay styles in milliseconds", () => {
    expect(dashboardAnimationDelay(160)).toEqual({ animationDelay: "160ms" });
  });

  it("clamps repeated stagger values to the configured cap", () => {
    expect(dashboardClampedStaggerMs(0)).toBe(0);
    expect(dashboardClampedStaggerMs(2)).toBe(80);
    expect(dashboardClampedStaggerMs(8)).toBe(200);
    expect(dashboardClampedStaggerMs(8, 160)).toBe(360);
  });

  it("returns stagger styles with overridable base and step", () => {
    expect(dashboardStaggerDelay(3)).toEqual({ animationDelay: "120ms" });
    expect(
      dashboardStaggerDelay(4, {
        baseMs: 200,
        stepMs: 50,
        maxExtraMs: 150,
      }),
    ).toEqual({ animationDelay: "350ms" });
  });
});
