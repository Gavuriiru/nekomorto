type IdleCallbackHandle = number;

type IdleCallback = (deadline: IdleDeadline) => void;

type BrowserWindowWithIdle = Window & typeof globalThis;

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

export const scheduleOnBrowserLoadIdle = (callback: IdleCallback): (() => void) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  let cancelIdle = () => undefined;
  const schedule = () => {
    cancelIdle = scheduleOnBrowserIdle(callback);
  };

  if (document.readyState === "complete") {
    schedule();
    return () => cancelIdle();
  }

  const handleLoad = () => {
    window.removeEventListener("load", handleLoad);
    schedule();
  };

  window.addEventListener("load", handleLoad, { once: true });

  return () => {
    window.removeEventListener("load", handleLoad);
    cancelIdle();
  };
};
