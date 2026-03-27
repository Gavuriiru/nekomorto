type EventTargetLike = Pick<Window, "addEventListener" | "removeEventListener">;
type StorageLike = Pick<Storage, "getItem" | "setItem">;
type LocationLike = Pick<Location, "pathname" | "search" | "reload">;

const PRELOAD_RECOVERY_STORAGE_PREFIX = "nekomata:vite-preload-recovery:";
const PRELOAD_RECOVERY_STORAGE_VALUE = "reloaded";

const normalizePathname = (value: string | undefined) => {
  const normalized = String(value || "").trim();
  return normalized || "/";
};

const normalizeSearch = (value: string | undefined) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  return normalized.startsWith("?") ? normalized : `?${normalized}`;
};

const readStorageItem = (storage: StorageLike, key: string) => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorageItem = (storage: StorageLike, key: string, value: string) => {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export const resolveVitePreloadRecoveryKey = ({
  pathname,
  search,
}: {
  pathname?: string;
  search?: string;
} = {}) =>
  `${PRELOAD_RECOVERY_STORAGE_PREFIX}${normalizePathname(pathname)}${normalizeSearch(search)}`;

export const installVitePreloadRecovery = ({
  eventTarget,
  storage,
  location,
}: {
  eventTarget?: EventTargetLike;
  storage?: StorageLike;
  location?: LocationLike;
} = {}) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const resolvedEventTarget = eventTarget || window;
  const resolvedStorage = storage || window.sessionStorage;
  const resolvedLocation = location || window.location;
  const recoveryKey = resolveVitePreloadRecoveryKey({
    pathname: resolvedLocation.pathname,
    search: resolvedLocation.search,
  });

  const handlePreloadError = (event: Event) => {
    if (readStorageItem(resolvedStorage, recoveryKey) === PRELOAD_RECOVERY_STORAGE_VALUE) {
      return;
    }
    if (!writeStorageItem(resolvedStorage, recoveryKey, PRELOAD_RECOVERY_STORAGE_VALUE)) {
      return;
    }
    event.preventDefault?.();
    resolvedLocation.reload();
  };

  resolvedEventTarget.addEventListener("vite:preloadError", handlePreloadError);
  return () => {
    resolvedEventTarget.removeEventListener("vite:preloadError", handlePreloadError);
  };
};
