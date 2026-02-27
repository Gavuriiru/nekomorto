import { describe, expect, it } from "vitest";

import {
  SecurityEventSeverity,
  SecurityEventStatus,
  createSecurityEventPayload,
  createSlidingWindowCounter,
  getIpv4Network24,
  normalizeSecurityEventSeverity,
  normalizeSecurityEventStatus,
  normalizeSecurityEventType,
} from "../../server/lib/security-events.js";

describe("security-events", () => {
  it("normalizes severity/status/type safely", () => {
    expect(normalizeSecurityEventSeverity("CRITICAL")).toBe(SecurityEventSeverity.CRITICAL);
    expect(normalizeSecurityEventSeverity("unknown")).toBe(SecurityEventSeverity.INFO);
    expect(normalizeSecurityEventStatus("RESOLVED")).toBe(SecurityEventStatus.RESOLVED);
    expect(normalizeSecurityEventStatus("x")).toBe(SecurityEventStatus.OPEN);
    expect(normalizeSecurityEventType("Admin Action!")).toBe("admin_action_");
  });

  it("extracts /24 network for ipv4 and ignores invalid values", () => {
    expect(getIpv4Network24("10.22.33.99")).toBe("10.22.33.0/24");
    expect(getIpv4Network24("2001:db8::1")).toBe("");
    expect(getIpv4Network24("not-an-ip")).toBe("");
  });

  it("builds normalized security event payload", () => {
    const payload = createSecurityEventPayload({
      type: "auth_failed",
      severity: "warning",
      status: "open",
      riskScore: 12.9,
      actorUserId: "u1",
      targetUserId: "u1",
      ip: "10.0.0.1",
      userAgent: "ua",
      requestId: "r1",
      data: { x: 1 },
    });

    expect(typeof payload.id).toBe("string");
    expect(payload.severity).toBe("warning");
    expect(payload.status).toBe("open");
    expect(payload.riskScore).toBe(12);
    expect(payload.actorUserId).toBe("u1");
  });

  it("counts events in sliding window", () => {
    const counter = createSlidingWindowCounter();
    const base = 1_700_000_000_000;
    expect(counter.record({ key: "ip:1", nowTs: base, windowMs: 1_000 }).count).toBe(1);
    expect(counter.record({ key: "ip:1", nowTs: base + 500, windowMs: 1_000 }).count).toBe(2);
    expect(counter.count({ key: "ip:1", nowTs: base + 2_500, windowMs: 1_000 })).toBe(0);
  });
});
