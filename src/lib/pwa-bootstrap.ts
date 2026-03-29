import { scheduleOnBrowserLoadIdle } from "@/lib/browser-idle";
import { shouldRegisterPwaImmediately } from "@/lib/pwa-navigation";

type BootstrapPwaWindowLike = {
  __BOOTSTRAP_PWA_ENABLED__?: unknown;
  location?: {
    pathname?: string;
  };
  navigator?: {
    serviceWorker?: {
      controller?: unknown;
    };
  };
};

const DEFAULT_PWA_REGISTRATION_DELAY_MS = 15_000;

export const readBootstrapPwaEnabled = (globalWindow?: BootstrapPwaWindowLike | null) =>
  globalWindow?.__BOOTSTRAP_PWA_ENABLED__ === true;

export const scheduleBootstrapPwaRegistration = ({
  globalWindow,
  registerPwa,
  scheduleRegistration = (callback: () => void) => {
    scheduleOnBrowserLoadIdle(callback, { delayMs: DEFAULT_PWA_REGISTRATION_DELAY_MS });
  },
}: {
  globalWindow?: BootstrapPwaWindowLike | null;
  registerPwa: () => void;
  scheduleRegistration?: (callback: () => void) => void;
}) => {
  if (!readBootstrapPwaEnabled(globalWindow)) {
    return false;
  }

  const pathname = String(globalWindow?.location?.pathname || "/");
  const hasServiceWorkerController = Boolean(globalWindow?.navigator?.serviceWorker?.controller);

  if (
    shouldRegisterPwaImmediately({
      pathname,
      hasServiceWorkerController,
    })
  ) {
    registerPwa();
    return true;
  }

  scheduleRegistration(registerPwa);
  return true;
};

export default scheduleBootstrapPwaRegistration;
