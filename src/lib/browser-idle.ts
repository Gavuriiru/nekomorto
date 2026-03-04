type IdleCallbackHandle = number;

type IdleCallback = (deadline: IdleDeadline) => void;

type BrowserWindowWithIdle = Window & typeof globalThis;

type BrowserLoadIdleOptions = {
  delayMs?: number;
};

const createFallbackDeadline = (): IdleDeadline => ({
  didTimeout: false,
  timeRemaining: () => 0,
});

export const scheduleOnBrowserIdle = (callback: IdleCallback): (() => void) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const browserWindow = window as BrowserWindowWithIdle;
  if (typeof browserWindow.requestIdleCallback === "function") {
    const handle = browserWindow.requestIdleCallback(callback);
    return () => browserWindow.cancelIdleCallback?.(handle);
  }

  const timeoutHandle = window.setTimeout(() => {
    callback(createFallbackDeadline());
  }, 1);
  return () => window.clearTimeout(timeoutHandle);
};

export const scheduleOnBrowserLoadIdle = (
  callback: IdleCallback,
  options: BrowserLoadIdleOptions = {},
): (() => void) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  let cancelIdle = () => undefined;
  let delayHandle: number | null = null;
  let isCancelled = false;
  const delayMs = Math.max(0, Number(options.delayMs || 0));

  const clearDelay = () => {
    if (delayHandle === null) {
      return;
    }
    window.clearTimeout(delayHandle);
    delayHandle = null;
  };

  const schedule = () => {
    if (isCancelled) {
      return;
    }
    cancelIdle = scheduleOnBrowserIdle(callback);
  };
  const scheduleAfterDelay = () => {
    if (delayMs <= 0) {
      schedule();
      return;
    }
    clearDelay();
    delayHandle = window.setTimeout(() => {
      delayHandle = null;
      schedule();
    }, delayMs);
  };

  if (document.readyState === "complete") {
    scheduleAfterDelay();
    return () => {
      isCancelled = true;
      clearDelay();
      cancelIdle();
    };
  }

  const handleLoad = () => {
    window.removeEventListener("load", handleLoad);
    scheduleAfterDelay();
  };

  window.addEventListener("load", handleLoad, { once: true });

  return () => {
    isCancelled = true;
    window.removeEventListener("load", handleLoad);
    clearDelay();
    cancelIdle();
  };
};
