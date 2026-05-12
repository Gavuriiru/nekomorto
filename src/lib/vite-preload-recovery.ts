type EventTargetLike = Pick<Window, "addEventListener" | "removeEventListener">;
type StorageLike = Pick<Storage, "getItem" | "setItem">;
type LocationLike = Pick<Location, "pathname" | "search" | "reload">;

const PRELOAD_RECOVERY_STORAGE_PREFIX = "nekomata:vite-preload-recovery:";
const PRELOAD_RECOVERY_STORAGE_VALUE = "reloaded";
const RECOVERABLE_DYNAMIC_IMPORT_ERROR_PATTERNS = [
  "failed to fetch dynamically imported module",
  "importing a module script failed",
  "error loading dynamically imported module",
] as const;

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

const extractErrorMessage = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Error) {
    return value.message || "";
  }
  if (value && typeof value === "object") {
    const candidate = "message" in value ? value.message : "";
    return typeof candidate === "string" ? candidate : "";
  }
  return "";
};

const isRecoverableDynamicImportMessage = (value: unknown) => {
  const message = extractErrorMessage(value).trim().toLowerCase();
  if (!message) {
    return false;
  }
  return RECOVERABLE_DYNAMIC_IMPORT_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
};

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

  const attemptRecovery = (event: Event) => {
    if (readStorageItem(resolvedStorage, recoveryKey) === PRELOAD_RECOVERY_STORAGE_VALUE) {
      return;
    }
    if (!writeStorageItem(resolvedStorage, recoveryKey, PRELOAD_RECOVERY_STORAGE_VALUE)) {
      return;
    }
    event.preventDefault?.();
    resolvedLocation.reload();
  };

  const handlePreloadError = (event: Event) => {
    attemptRecovery(event);
  };

  const handleUnhandledRejection = (event: Event) => {
    const rejectionEvent = event as Event & { reason?: unknown };
    if (!isRecoverableDynamicImportMessage(rejectionEvent.reason)) {
      return;
    }
    attemptRecovery(event);
  };

  const handleGlobalError = (event: Event) => {
    const errorEvent = event as Event & { error?: unknown; message?: unknown };
    if (
      !isRecoverableDynamicImportMessage(errorEvent.error) &&
      !isRecoverableDynamicImportMessage(errorEvent.message)
    ) {
      return;
    }
    attemptRecovery(event);
  };

  resolvedEventTarget.addEventListener("vite:preloadError", handlePreloadError);
  resolvedEventTarget.addEventListener("unhandledrejection", handleUnhandledRejection);
  resolvedEventTarget.addEventListener("error", handleGlobalError);
  return () => {
    resolvedEventTarget.removeEventListener("vite:preloadError", handlePreloadError);
    resolvedEventTarget.removeEventListener("unhandledrejection", handleUnhandledRejection);
    resolvedEventTarget.removeEventListener("error", handleGlobalError);
  };
};
