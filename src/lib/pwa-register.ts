type PwaRegisterCallbacks = {
  onNeedRefresh?: (applyUpdate: () => void) => void;
  onOfflineReady?: () => void;
  immediate?: boolean;
};

export type PwaRegisterHandle = {
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
};

const LEGACY_PWA_RELOAD_SENTINEL_KEY = "nekomata:pwa-legacy-cleanup-reloaded";

let registrationPromise: Promise<PwaRegisterHandle | null> | null = null;
let reloadPwaPage = () => {
  window.location.reload();
};

const readLegacyPwaReloadSentinel = () => {
  try {
    return window.sessionStorage.getItem(LEGACY_PWA_RELOAD_SENTINEL_KEY) === "true";
  } catch {
    return false;
  }
};

const writeLegacyPwaReloadSentinel = () => {
  try {
    window.sessionStorage.setItem(LEGACY_PWA_RELOAD_SENTINEL_KEY, "true");
  } catch {
    // Ignore storage failures and continue with the cleanup flow.
  }
};

const clearLegacyPwaReloadSentinel = () => {
  try {
    window.sessionStorage.removeItem(LEGACY_PWA_RELOAD_SENTINEL_KEY);
  } catch {
    // Ignore storage failures and continue with the cleanup flow.
  }
};

const hasLegacyPwaScriptUrl = (scriptUrl: string | null | undefined) => {
  const normalizedScriptUrl = String(scriptUrl || "").trim();
  if (!normalizedScriptUrl) {
    return false;
  }
  const lowercaseScriptUrl = normalizedScriptUrl.toLowerCase();
  if (lowercaseScriptUrl.includes("vite-plugin-pwa")) {
    return true;
  }
  try {
    const parsedUrl = new URL(normalizedScriptUrl, window.location.origin);
    return (
      parsedUrl.pathname.toLowerCase().includes("dev-sw") ||
      parsedUrl.search.toLowerCase().includes("dev-sw")
    );
  } catch {
    return lowercaseScriptUrl.includes("dev-sw");
  }
};

const getRegistrationScriptUrls = (registration: ServiceWorkerRegistration) =>
  [registration.active, registration.installing, registration.waiting]
    .map((worker) => String(worker?.scriptURL || "").trim())
    .filter(Boolean);

const isLegacyPwaRegistration = (registration: ServiceWorkerRegistration) =>
  getRegistrationScriptUrls(registration).some((scriptUrl) => hasLegacyPwaScriptUrl(scriptUrl));

const cleanupLegacyPwaRegistrations = async ({
  serviceWorker,
}: {
  serviceWorker: ServiceWorkerContainer;
}) => {
  if (typeof serviceWorker.getRegistrations !== "function") {
    clearLegacyPwaReloadSentinel();
    return { removedLegacyRegistration: false, shouldReload: false };
  }

  let registrations: ServiceWorkerRegistration[] = [];
  try {
    registrations = await serviceWorker.getRegistrations();
  } catch {
    return { removedLegacyRegistration: false, shouldReload: false };
  }

  const legacyRegistrations = registrations.filter((registration) =>
    isLegacyPwaRegistration(registration),
  );

  if (legacyRegistrations.length === 0) {
    clearLegacyPwaReloadSentinel();
    return { removedLegacyRegistration: false, shouldReload: false };
  }

  const unregisterResults = await Promise.all(
    legacyRegistrations.map(async (registration) => {
      try {
        return await registration.unregister();
      } catch {
        return false;
      }
    }),
  );

  const removedLegacyRegistration = unregisterResults.some(Boolean);
  if (!removedLegacyRegistration) {
    return { removedLegacyRegistration: false, shouldReload: false };
  }

  if (!readLegacyPwaReloadSentinel()) {
    writeLegacyPwaReloadSentinel();
    return { removedLegacyRegistration: true, shouldReload: true };
  }

  return { removedLegacyRegistration: true, shouldReload: false };
};

export const registerPwa = (callbacks: PwaRegisterCallbacks = {}) => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return Promise.resolve<PwaRegisterHandle | null>(null);
  }
  if (registrationPromise) {
    return registrationPromise;
  }

  registrationPromise = (async () => {
    try {
      const serviceWorker = navigator.serviceWorker;
      const legacyCleanup = await cleanupLegacyPwaRegistrations({
        serviceWorker,
      });
      if (legacyCleanup.shouldReload) {
        reloadPwaPage();
        return null;
      }

      let hasOfflineReadyNotified = false;
      let hasNeedRefreshNotified = false;
      let shouldReloadOnControllerChange = false;
      const reloadOnControllerChange = () => {
        if (!shouldReloadOnControllerChange) {
          return;
        }
        shouldReloadOnControllerChange = false;
        reloadPwaPage();
      };
      serviceWorker.addEventListener("controllerchange", reloadOnControllerChange);

      const registration = await serviceWorker.register("/sw.js");
      const maybeNotifyOfflineReady = () => {
        if (hasOfflineReadyNotified) {
          return;
        }
        hasOfflineReadyNotified = true;
        callbacks.onOfflineReady?.();
      };
      const maybeNotifyNeedRefresh = () => {
        if (hasNeedRefreshNotified) {
          return;
        }
        hasNeedRefreshNotified = true;
        const applyUpdate = () => {
          void updateServiceWorker(true);
        };
        if (callbacks.onNeedRefresh) {
          callbacks.onNeedRefresh(applyUpdate);
          return;
        }
        applyUpdate();
      };
      const updateServiceWorker = async (reloadPage = true) => {
        shouldReloadOnControllerChange = reloadPage;
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
          if (!reloadPage) {
            shouldReloadOnControllerChange = false;
          }
          return;
        }
        await registration.update();
        if (reloadPage && !registration.waiting) {
          reloadPwaPage();
        }
      };

      if (registration.waiting && serviceWorker.controller) {
        maybeNotifyNeedRefresh();
      }

      registration.addEventListener("updatefound", () => {
        const installingWorker = registration.installing;
        if (!installingWorker) {
          return;
        }
        installingWorker.addEventListener("statechange", () => {
          if (installingWorker.state === "installed") {
            if (serviceWorker.controller) {
              maybeNotifyNeedRefresh();
              return;
            }
            maybeNotifyOfflineReady();
          }
          if (installingWorker.state === "activated") {
            maybeNotifyOfflineReady();
          }
        });
      });

      if (callbacks.immediate ?? true) {
        void registration.update();
      }

      void serviceWorker.ready.then(() => {
        maybeNotifyOfflineReady();
      });

      return {
        updateServiceWorker: async (reloadPage = true) => {
          await updateServiceWorker(reloadPage);
        },
      };
    } catch {
      return null;
    }
  })();

  return registrationPromise;
};

export const __resetPwaRegisterForTests = () => {
  registrationPromise = null;
  reloadPwaPage = () => {
    window.location.reload();
  };
  if (typeof window !== "undefined") {
    clearLegacyPwaReloadSentinel();
  }
};

export const __setPwaReloadForTests = (reload: (() => void) | null | undefined) => {
  reloadPwaPage =
    typeof reload === "function"
      ? reload
      : () => {
          window.location.reload();
        };
};
