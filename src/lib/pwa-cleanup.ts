const PWA_CLEANUP_RELOAD_SENTINEL_KEY = "nekomata:pwa-cleanup-reloaded";
const PWA_CLEANUP_RELOAD_MESSAGE = "NEKOMATA_SW_CLEANUP_RELOAD";
const DASHBOARD_PATH_PATTERN = /^\/dashboard(?:[/?]|$)/;

const normalizePathname = (value: unknown) =>
  String(value || "/")
    .trim()
    .split(/[?#]/, 1)[0] || "/";

const shouldReloadForPath = (pathname: unknown) =>
  !DASHBOARD_PATH_PATTERN.test(normalizePathname(pathname));

const readReloadSentinel = (storage?: Pick<Storage, "getItem"> | null) => {
  try {
    return storage?.getItem(PWA_CLEANUP_RELOAD_SENTINEL_KEY) === "true";
  } catch {
    return false;
  }
};

const writeReloadSentinel = (storage?: Pick<Storage, "setItem"> | null) => {
  try {
    storage?.setItem(PWA_CLEANUP_RELOAD_SENTINEL_KEY, "true");
  } catch {
    // Ignore session storage failures and continue without the sentinel.
  }
};

const clearReloadSentinel = (storage?: Pick<Storage, "removeItem"> | null) => {
  try {
    storage?.removeItem(PWA_CLEANUP_RELOAD_SENTINEL_KEY);
  } catch {
    // Ignore session storage failures and continue without the sentinel.
  }
};

const clearLegacyCaches = async (cacheStorage?: CacheStorage | null) => {
  if (!cacheStorage || typeof cacheStorage.keys !== "function") {
    return false;
  }

  let cacheKeys: string[] = [];
  try {
    cacheKeys = await cacheStorage.keys();
  } catch {
    return false;
  }

  if (cacheKeys.length === 0) {
    return false;
  }

  const deletionResults = await Promise.all(
    cacheKeys.map(async (cacheKey) => {
      try {
        return await cacheStorage.delete(cacheKey);
      } catch {
        return false;
      }
    }),
  );

  return deletionResults.some(Boolean);
};

const unregisterServiceWorkers = async (
  serviceWorker?: Pick<ServiceWorkerContainer, "getRegistrations"> | null,
) => {
  if (!serviceWorker || typeof serviceWorker.getRegistrations !== "function") {
    return false;
  }

  let registrations: readonly ServiceWorkerRegistration[] = [];
  try {
    registrations = await serviceWorker.getRegistrations();
  } catch {
    return false;
  }

  if (registrations.length === 0) {
    return false;
  }

  const unregisterResults = await Promise.all(
    registrations.map(async (registration) => {
      try {
        return await registration.unregister();
      } catch {
        return false;
      }
    }),
  );

  return unregisterResults.some(Boolean);
};

const reloadOnceForCleanup = ({
  pathname,
  sessionStorage,
  reloadPage,
}: {
  pathname: unknown;
  sessionStorage?: Pick<Storage, "getItem" | "removeItem" | "setItem"> | null;
  reloadPage: () => void;
}) => {
  if (!shouldReloadForPath(pathname)) {
    clearReloadSentinel(sessionStorage);
    return false;
  }

  if (readReloadSentinel(sessionStorage)) {
    return false;
  }

  writeReloadSentinel(sessionStorage);
  reloadPage();
  return true;
};

export const installPwaCleanupReloadBridge = ({
  globalWindow = window,
  globalNavigator = navigator,
  sessionStorage = globalWindow.sessionStorage,
  reloadPage = () => {
    globalWindow.location.reload();
  },
  pathname = globalWindow.location.pathname,
}: {
  globalWindow?: Window & typeof globalThis;
  globalNavigator?: Navigator;
  sessionStorage?: Pick<Storage, "getItem" | "removeItem" | "setItem"> | null;
  reloadPage?: () => void;
  pathname?: unknown;
} = {}) => {
  const serviceWorker = globalNavigator?.serviceWorker;
  if (!serviceWorker || typeof serviceWorker.addEventListener !== "function") {
    return () => undefined;
  }

  const onMessage = (event: Event) => {
    const messageEvent = event as MessageEvent<{ type?: string }>;
    if (messageEvent.data?.type !== PWA_CLEANUP_RELOAD_MESSAGE) {
      return;
    }

    reloadOnceForCleanup({
      pathname,
      sessionStorage,
      reloadPage,
    });
  };

  serviceWorker.addEventListener("message", onMessage);

  return () => {
    if (typeof serviceWorker.removeEventListener === "function") {
      serviceWorker.removeEventListener("message", onMessage);
    }
  };
};

export const runPwaCleanup = async ({
  globalWindow = window,
  globalNavigator = navigator,
  cacheStorage = globalThis.caches,
  sessionStorage = globalWindow.sessionStorage,
  reloadPage = () => {
    globalWindow.location.reload();
  },
  pathname = globalWindow.location.pathname,
}: {
  globalWindow?: Window & typeof globalThis;
  globalNavigator?: Navigator;
  cacheStorage?: CacheStorage | null;
  sessionStorage?: Pick<Storage, "getItem" | "removeItem" | "setItem"> | null;
  reloadPage?: () => void;
  pathname?: unknown;
} = {}) => {
  const serviceWorker = globalNavigator?.serviceWorker;

  const [removedRegistrations, clearedCaches] = await Promise.all([
    unregisterServiceWorkers(serviceWorker),
    clearLegacyCaches(cacheStorage),
  ]);

  if (!removedRegistrations && !clearedCaches) {
    clearReloadSentinel(sessionStorage);
    return {
      removedRegistrations,
      clearedCaches,
      reloaded: false,
    };
  }

  return {
    removedRegistrations,
    clearedCaches,
    reloaded: reloadOnceForCleanup({
      pathname,
      sessionStorage,
      reloadPage,
    }),
  };
};
