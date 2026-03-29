import { describe, expect, it, vi } from "vitest";

import {
  readBootstrapPwaEnabled,
  scheduleBootstrapPwaRegistration,
} from "@/lib/pwa-bootstrap";

describe("pwa-bootstrap", () => {
  it("reads the bootstrap flag strictly from the server global", () => {
    expect(readBootstrapPwaEnabled({ __BOOTSTRAP_PWA_ENABLED__: true })).toBe(true);
    expect(readBootstrapPwaEnabled({ __BOOTSTRAP_PWA_ENABLED__: false })).toBe(false);
    expect(readBootstrapPwaEnabled({ __BOOTSTRAP_PWA_ENABLED__: "true" })).toBe(false);
    expect(readBootstrapPwaEnabled()).toBe(false);
  });

  it("skips registration entirely when the bootstrap flag is disabled", () => {
    const registerPwa = vi.fn();
    const scheduleRegistration = vi.fn();

    expect(
      scheduleBootstrapPwaRegistration({
        globalWindow: {
          __BOOTSTRAP_PWA_ENABLED__: false,
          location: { pathname: "/" },
          navigator: { serviceWorker: { controller: {} } },
        },
        registerPwa,
        scheduleRegistration,
      }),
    ).toBe(false);

    expect(registerPwa).not.toHaveBeenCalled();
    expect(scheduleRegistration).not.toHaveBeenCalled();
  });

  it("registers immediately when the page is already controlled on home", () => {
    const registerPwa = vi.fn();
    const scheduleRegistration = vi.fn();

    expect(
      scheduleBootstrapPwaRegistration({
        globalWindow: {
          __BOOTSTRAP_PWA_ENABLED__: true,
          location: { pathname: "/" },
          navigator: { serviceWorker: { controller: {} } },
        },
        registerPwa,
        scheduleRegistration,
      }),
    ).toBe(true);

    expect(registerPwa).toHaveBeenCalledTimes(1);
    expect(scheduleRegistration).not.toHaveBeenCalled();
  });

  it("schedules deferred registration when the route should not register immediately", () => {
    const registerPwa = vi.fn();
    const scheduleRegistration = vi.fn((callback: () => void) => callback());

    expect(
      scheduleBootstrapPwaRegistration({
        globalWindow: {
          __BOOTSTRAP_PWA_ENABLED__: true,
          location: { pathname: "/dashboard" },
          navigator: { serviceWorker: { controller: {} } },
        },
        registerPwa,
        scheduleRegistration,
      }),
    ).toBe(true);

    expect(scheduleRegistration).toHaveBeenCalledTimes(1);
    expect(registerPwa).toHaveBeenCalledTimes(1);
  });
});
