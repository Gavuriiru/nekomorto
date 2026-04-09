export const HOME_HERO_READY_EVENT = "nekomata:hero-ready";
export const PUBLIC_HOME_HERO_VIEWPORT_CLASS = "public-home-hero-viewport";
export const PUBLIC_HOME_HERO_SHELL_EXIT_CLASS = "public-home-hero-shell--exiting";

type HomeHeroShellCleanupOptions = {
  globalWindow?: Window;
  shellId?: string;
  readyEvent?: string;
  safetyTimeoutMs?: number;
  exitTransitionFallbackMs?: number;
};

export const armHomeHeroShellCleanup = ({
  globalWindow = window,
  shellId = "home-hero-shell",
  readyEvent = HOME_HERO_READY_EVENT,
  safetyTimeoutMs = 7000,
  exitTransitionFallbackMs = 260,
}: HomeHeroShellCleanupOptions = {}) => {
  const shell = globalWindow.document.getElementById(shellId);
  if (!shell) {
    return () => undefined;
  }

  let safetyTimeoutId = 0;
  let transitionFallbackId = 0;
  let removed = false;
  let exiting = false;

  const clearTimers = () => {
    if (safetyTimeoutId) {
      globalWindow.clearTimeout(safetyTimeoutId);
      safetyTimeoutId = 0;
    }
    if (transitionFallbackId) {
      globalWindow.clearTimeout(transitionFallbackId);
      transitionFallbackId = 0;
    }
  };

  const handleTransitionEnd = (event: Event) => {
    if (event.target !== shell) {
      return;
    }
    finalizeRemoval();
  };

  const finalizeRemoval = () => {
    if (removed) {
      return;
    }
    removed = true;
    clearTimers();
    shell.removeEventListener("transitionend", handleTransitionEnd);
    globalWindow.removeEventListener(readyEvent, startShellExit);
    shell.remove();
  };

  const startShellExit = () => {
    if (removed || exiting) {
      return;
    }
    exiting = true;
    shell.classList.add(PUBLIC_HOME_HERO_SHELL_EXIT_CLASS);
    shell.addEventListener("transitionend", handleTransitionEnd);
    transitionFallbackId = globalWindow.setTimeout(finalizeRemoval, exitTransitionFallbackMs);
  };

  globalWindow.addEventListener(readyEvent, startShellExit, { once: true });
  safetyTimeoutId = globalWindow.setTimeout(startShellExit, safetyTimeoutMs);

  return () => {
    clearTimers();
    shell.removeEventListener("transitionend", handleTransitionEnd);
    globalWindow.removeEventListener(readyEvent, startShellExit);
  };
};
