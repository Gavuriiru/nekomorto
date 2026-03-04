import { describe, expect, it } from "vitest";

import {
  buildAuthRedirectUrl,
  establishAuthenticatedSession,
  saveSessionState,
} from "../../server/lib/session-auth.js";

describe("session-auth", () => {
  it("regenerates session before attaching authenticated user", async () => {
    const req = {
      session: {
        regenerate: (callback: (error?: Error | null) => void) => {
          req.session = {};
          callback(null);
        },
      },
    } as unknown as {
      session: {
        regenerate?: (callback: (error?: Error | null) => void) => void;
        user?: { id: string; name: string };
        loginNext?: string | null;
      };
    };

    await establishAuthenticatedSession({
      req,
      user: { id: "42", name: "Gabriel" },
      preserved: { loginNext: null },
    });

    expect(req.session.user).toEqual({ id: "42", name: "Gabriel" });
    expect(req.session.loginNext).toBeNull();
  });

  it("throws when session regeneration fails", async () => {
    const req = {
      session: {
        regenerate: (callback: (error?: Error | null) => void) => {
          callback(new Error("boom"));
        },
      },
    };

    await expect(
      establishAuthenticatedSession({
        req,
        user: { id: "42", name: "Gabriel" },
      }),
    ).rejects.toThrow("boom");
  });

  it("saves the current session state when save() succeeds", async () => {
    const req = {
      session: {
        save: (callback: (error?: Error | null) => void) => {
          callback(null);
        },
      },
    };

    await expect(saveSessionState(req)).resolves.toBeUndefined();
  });

  it("throws when session save fails", async () => {
    const req = {
      session: {
        save: (callback: (error?: Error | null) => void) => {
          callback(new Error("persist_failed"));
        },
      },
    };

    await expect(saveSessionState(req)).rejects.toThrow("persist_failed");
  });

  it("throws when there is no session to save", async () => {
    await expect(saveSessionState({})).rejects.toThrow("session_unavailable");
  });
});

describe("buildAuthRedirectUrl", () => {
  it("builds login error redirects on the same app origin", () => {
    expect(
      buildAuthRedirectUrl({
        appOrigin: "http://localhost:5173",
        path: "/login",
        searchParams: { error: "state_mismatch" },
      }),
    ).toBe("http://localhost:5173/login?error=state_mismatch");
  });

  it("builds success redirects preserving the requested dashboard path", () => {
    expect(
      buildAuthRedirectUrl({
        appOrigin: "http://localhost:5173",
        path: "/dashboard/posts",
      }),
    ).toBe("http://localhost:5173/dashboard/posts");
  });

  it("builds MFA redirects on the same app origin", () => {
    expect(
      buildAuthRedirectUrl({
        appOrigin: "http://localhost:5173",
        path: "/login",
        searchParams: {
          mfa: "required",
          next: "/dashboard/posts",
        },
      }),
    ).toBe("http://localhost:5173/login?mfa=required&next=%2Fdashboard%2Fposts");
  });

  it("keeps existing query parameters when building redirects", () => {
    expect(
      buildAuthRedirectUrl({
        appOrigin: "http://localhost:5173",
        path: "/dashboard/posts?tab=scheduled",
      }),
    ).toBe("http://localhost:5173/dashboard/posts?tab=scheduled");
  });
});
