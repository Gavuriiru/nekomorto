import { clearSkipRouteMotion, consumePopstate, initRouteMotion } from "@/lib/route-motion";
import { afterEach, describe, expect, it } from "vitest";

describe("route-motion", () => {
  afterEach(() => {
    document.documentElement.classList.remove("skip-route-motion");
  });

  it("deteta popstate e adiciona classe skip-route-motion", () => {
    const detach = initRouteMotion();

    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(document.documentElement.classList.contains("skip-route-motion")).toBe(true);
    expect(consumePopstate()).toBe(true);
    expect(consumePopstate()).toBe(false);

    detach();
  });

  it("consumePopstate reseta flag apos consumo", () => {
    const detach = initRouteMotion();

    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(consumePopstate()).toBe(true);
    expect(consumePopstate()).toBe(false);

    detach();
  });

  it("clearSkipRouteMotion remove classe skip-route-motion", () => {
    document.documentElement.classList.add("skip-route-motion");

    clearSkipRouteMotion();

    expect(document.documentElement.classList.contains("skip-route-motion")).toBe(false);
  });

  it("detach remove listener de popstate", () => {
    const detach = initRouteMotion();

    detach();

    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(consumePopstate()).toBe(false);
    expect(document.documentElement.classList.contains("skip-route-motion")).toBe(false);
  });
});
