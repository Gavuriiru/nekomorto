type PwaRegisterCallbacks = {
  onNeedRefresh?: (applyUpdate: () => void) => void;
  onOfflineReady?: () => void;
  immediate?: boolean;
};

export type PwaRegisterHandle = {
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
};

let registrationPromise: Promise<PwaRegisterHandle | null> | null = null;

export const registerPwa = (callbacks: PwaRegisterCallbacks = {}) => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return Promise.resolve<PwaRegisterHandle | null>(null);
  }
  if (registrationPromise) {
    return registrationPromise;
  }

  registrationPromise = (async () => {
    try {
      let hasOfflineReadyNotified = false;
      let hasNeedRefreshNotified = false;
      let shouldReloadOnControllerChange = false;
      const reloadOnControllerChange = () => {
        if (!shouldReloadOnControllerChange) {
          return;
        }
        shouldReloadOnControllerChange = false;
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener("controllerchange", reloadOnControllerChange);

      const registration = await navigator.serviceWorker.register("/sw.js");
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
          window.location.reload();
        }
      };

      if (registration.waiting && navigator.serviceWorker.controller) {
        maybeNotifyNeedRefresh();
      }

      registration.addEventListener("updatefound", () => {
        const installingWorker = registration.installing;
        if (!installingWorker) {
          return;
        }
        installingWorker.addEventListener("statechange", () => {
          if (installingWorker.state === "installed") {
            if (navigator.serviceWorker.controller) {
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

      void navigator.serviceWorker.ready.then(() => {
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
};
