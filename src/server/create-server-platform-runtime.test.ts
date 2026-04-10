import { describe, expect, it } from "vitest";

import {
  getRequestIp,
  normalizeRequestIp,
} from "../../server/bootstrap/create-server-platform-runtime.js";

describe("create-server-platform-runtime request ip", () => {
  it("normalizes ipv6-mapped ipv4 addresses", () => {
    expect(normalizeRequestIp("::ffff:127.0.0.1")).toBe("127.0.0.1");
  });

  it("ignores spoofed x-forwarded-for headers and uses req.ip", () => {
    expect(
      getRequestIp({
        headers: {
          "x-forwarded-for": "198.51.100.99",
        },
        ip: "::ffff:127.0.0.1",
      }),
    ).toBe("127.0.0.1");
  });
});
