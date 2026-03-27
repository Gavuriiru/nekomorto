import { describe, expect, it, vi } from "vitest";

import {
  installVitePreloadRecovery,
  resolveVitePreloadRecoveryKey,
} from "@/lib/vite-preload-recovery";

const createMemoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.has(key) ? values.get(key) || null : null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
};

describe("vite preload recovery", () => {
  it("builds a stable per-location recovery key", () => {
    expect(
      resolveVitePreloadRecoveryKey({
        pathname: "/dashboard/posts",
        search: "tab=scheduled",
      }),
    ).toBe("nekomata:vite-preload-recovery:/dashboard/posts?tab=scheduled");
  });

  it("reloads once for the same tab/location when vite preload fails", () => {
    const eventTarget = new EventTarget();
    const storage = createMemoryStorage();
    const reload = vi.fn();
    const cleanup = installVitePreloadRecovery({
      eventTarget,
      storage,
      location: {
        pathname: "/dashboard/posts",
        search: "?tab=scheduled",
        reload,
      },
    });

    const firstEvent = new Event("vite:preloadError", { cancelable: true });
    Object.assign(firstEvent, { payload: new Error("chunk-missing") });
    eventTarget.dispatchEvent(firstEvent);

    const secondEvent = new Event("vite:preloadError", { cancelable: true });
    Object.assign(secondEvent, { payload: new Error("chunk-missing") });
    eventTarget.dispatchEvent(secondEvent);

    cleanup();

    expect(firstEvent.defaultPrevented).toBe(true);
    expect(secondEvent.defaultPrevented).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
