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
      const pwaModule = await import("virtual:pwa-register");
      if (!pwaModule || typeof pwaModule.registerSW !== "function") {
        return null;
      }

      let hasOfflineReadyNotified = false;
      let hasNeedRefreshNotified = false;
      let updateServiceWorker = async (_reloadPage = true) => {};

      const registerSwResult = pwaModule.registerSW({
        immediate: callbacks.immediate ?? true,
        onNeedRefresh: () => {
          if (hasNeedRefreshNotified) {
            return;
          }
          hasNeedRefreshNotified = true;
          callbacks.onNeedRefresh?.(() => {
            void updateServiceWorker(true);
          });
        },
        onOfflineReady: () => {
          if (hasOfflineReadyNotified) {
            return;
          }
          hasOfflineReadyNotified = true;
          callbacks.onOfflineReady?.();
        },
      });

      if (typeof registerSwResult === "function") {
        updateServiceWorker = async (reloadPage = true) => {
          await registerSwResult(reloadPage);
        };
      }

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
