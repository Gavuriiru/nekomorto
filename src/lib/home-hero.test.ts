import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  HOME_HERO_READY_EVENT,
  PUBLIC_HOME_HERO_SHELL_EXIT_CLASS,
  armHomeHeroShellCleanup,
} from "@/lib/home-hero";

describe("home-hero shell cleanup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="home-hero-shell"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts a fade-out on hero ready and removes the shell only once", () => {
    armHomeHeroShellCleanup({
      globalWindow: window,
      safetyTimeoutMs: 7_000,
      exitTransitionFallbackMs: 260,
    });

    const shell = document.getElementById("home-hero-shell");
    expect(shell).not.toBeNull();

    window.dispatchEvent(new Event(HOME_HERO_READY_EVENT));
    expect(shell).toHaveClass(PUBLIC_HOME_HERO_SHELL_EXIT_CLASS);

    shell?.dispatchEvent(new Event("transitionend"));
    expect(document.getElementById("home-hero-shell")).toBeNull();

    window.dispatchEvent(new Event(HOME_HERO_READY_EVENT));
    expect(document.querySelectorAll("#home-hero-shell")).toHaveLength(0);
  });

  it("uses the timeout fallback when no transition event arrives", async () => {
    armHomeHeroShellCleanup({
      globalWindow: window,
      safetyTimeoutMs: 100,
      exitTransitionFallbackMs: 250,
    });

    await vi.advanceTimersByTimeAsync(100);
    const shell = document.getElementById("home-hero-shell");
    expect(shell).toHaveClass(PUBLIC_HOME_HERO_SHELL_EXIT_CLASS);

    await vi.advanceTimersByTimeAsync(250);
    expect(document.getElementById("home-hero-shell")).toBeNull();
  });
});
