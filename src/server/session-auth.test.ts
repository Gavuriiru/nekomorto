import { describe, expect, it } from "vitest";

import { establishAuthenticatedSession } from "../../server/lib/session-auth.js";

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
});

