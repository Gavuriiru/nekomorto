import { describe, expect, it, vi } from "vitest";

import { applyBeforeUnloadCompatibility } from "@/lib/before-unload";

describe("applyBeforeUnloadCompatibility", () => {
  it("chama preventDefault e define returnValue", () => {
    const preventDefault = vi.fn();
    const event = {
      preventDefault,
      returnValue: undefined as string | undefined,
    } as unknown as BeforeUnloadEvent;

    applyBeforeUnloadCompatibility(event);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(Reflect.get(event as object, "returnValue")).toBe("");
  });
});
