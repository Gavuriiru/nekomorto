import { describe, expect, it, vi } from "vitest";

import { createSecurityEventsRuntime } from "../../server/lib/security-events-runtime.js";

const createDeps = (overrides = {}) => {
  let events = [
    {
      id: "existing-1",
      ts: "2026-03-28T10:00:00.000Z",
      type: "existing",
      severity: "info",
      riskScore: 10,
      status: "open",
      actorUserId: "user-1",
      targetUserId: null,
      ip: "10.0.0.1",
      userAgent: "ua",
      sessionId: "sid-existing",
      requestId: "req-existing",
      data: {},
    },
  ];

  return {
    appendAuditLog: vi.fn(),
    createSecurityEventPayload: vi.fn((payload) => ({
      id: `event-${events.length + 1}`,
      ts: "2026-03-28T12:00:00.000Z",
      ...payload,
    })),
    createSystemAuditReq: () => ({ system: true }),
    dispatchCriticalSecurityEventWebhook: vi.fn(),
    getIpv4Network24: (value) => {
      const text = String(value || "");
      const match = text.match(/^(\d+\.\d+\.\d+)\.\d+$/);
      return match ? `${match[1]}.0/24` : "";
    },
    getRequestIp: (req) => req?.ip || "",
    isAdminUser: vi.fn(() => true),
    loadSecurityEvents: () => events,
    loadUserSessionIndexRecords: vi.fn(() => []),
    metricsRegistry: {
      inc: vi.fn(),
    },
    newNetworkLookbackMs: 30 * 24 * 60 * 60 * 1000,
    normalizeSecurityEventStatus: (value) => String(value || "").trim().toLowerCase() || "open",
    securityEventCooldownMaxEntries: 100,
    securityEventCooldownMs: 10 * 60 * 1000,
    securityEventMaxRows: 1,
    securityEventSeverity: {
      WARNING: "warning",
      CRITICAL: "critical",
    },
    securityEventStatus: {
      OPEN: "open",
    },
    upsertSecurityEvent: vi.fn((event) => {
      const normalized = {
        ...event,
        id: event.id || `persisted-${events.length + 1}`,
      };
      const existingIndex = events.findIndex((item) => item.id === normalized.id);
      if (existingIndex >= 0) {
        events[existingIndex] = normalized;
      } else {
        events = [normalized, ...events];
      }
      return normalized;
    }),
    writeSecurityEvents: vi.fn((nextEvents) => {
      events = nextEvents;
    }),
    __getEvents: () => events,
    ...overrides,
  };
};

describe("security-events-runtime", () => {
  it("fails early when required dependencies are missing", () => {
    expect(() => createSecurityEventsRuntime()).toThrow(/missing required dependencies/i);
  });

  it("emits security events, sanitizes payload data, trims storage and records audit/metrics", () => {
    const deps = createDeps({
      securityEventMaxRows: 1,
    });
    const runtime = createSecurityEventsRuntime(deps);

    const saved = runtime.emitSecurityEvent({
      req: {
        ip: "10.0.0.55",
        headers: { "user-agent": "Vitest UA" },
        sessionID: "sid-1",
        requestId: "req-1",
        session: { user: { id: "admin-1" } },
      },
      type: "critical_rule",
      severity: "critical",
      riskScore: 99,
      targetUserId: "target-1",
      data: {
        keep: "x".repeat(1200),
        remove: undefined,
        list: Array.from({ length: 25 }, (_value, index) => index),
      },
    });

    expect(saved).toEqual(
      expect.objectContaining({
        type: "critical_rule",
        severity: "critical",
        status: "open",
        actorUserId: "admin-1",
        targetUserId: "target-1",
      }),
    );
    expect(deps.createSecurityEventPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        ip: "10.0.0.55",
        userAgent: "Vitest UA",
        sessionId: "sid-1",
        requestId: "req-1",
        data: expect.objectContaining({
          keep: "x".repeat(1000),
          list: Array.from({ length: 20 }, (_value, index) => index),
        }),
      }),
    );
    expect(deps.writeSecurityEvents).toHaveBeenCalledWith([
      expect.objectContaining({ id: saved.id }),
    ]);
    expect(deps.metricsRegistry.inc).toHaveBeenCalledWith("security_events_open_total", {
      severity: "critical",
      type: "critical_rule",
    });
    expect(deps.appendAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ip: "10.0.0.55",
      }),
      "security.event.open",
      "security",
      expect.objectContaining({
        id: saved.id,
        targetUserId: "target-1",
      }),
    );
    expect(deps.dispatchCriticalSecurityEventWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ id: saved.id }),
    );
  });

  it("updates existing security event status and serializes api payloads", () => {
    const deps = createDeps();
    const runtime = createSecurityEventsRuntime(deps);

    const updated = runtime.updateSecurityEventStatus({
      eventId: "existing-1",
      status: "resolved",
      actorUserId: "owner-1",
    });

    expect(updated).toEqual(
      expect.objectContaining({
        id: "existing-1",
        status: "resolved",
        data: expect.objectContaining({
          statusUpdatedBy: "owner-1",
        }),
      }),
    );
    expect(runtime.toSecurityEventApiResponse(updated)).toEqual(
      expect.objectContaining({
        id: "existing-1",
        status: "resolved",
        actorUserId: "user-1",
      }),
    );
  });

  it("emits admin new-network warnings only for unknown admin networks", () => {
    const deps = createDeps();
    const runtime = createSecurityEventsRuntime({
      ...deps,
      loadUserSessionIndexRecords: vi.fn(() => [
        {
          lastSeenAt: new Date().toISOString(),
          lastIp: "10.0.1.44",
        },
      ]),
    });

    runtime.maybeEmitAdminActionFromNewNetwork({
      path: "/api/admin/security/events",
      method: "post",
      ip: "10.0.2.20",
      session: { user: { id: "admin-1" } },
    });

    expect(deps.upsertSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "admin_action_from_new_network_warning",
        severity: "warning",
        actorUserId: "admin-1",
        data: expect.objectContaining({
          network: "10.0.2.0/24",
        }),
      }),
    );
  });
});
