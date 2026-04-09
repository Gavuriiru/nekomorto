import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installPwaCleanupReloadBridge, runPwaCleanup } from "@/lib/pwa-cleanup";

type EventListenerCallback = (event: Event) => void;

const createServiceWorkerEventTarget = () => {
  const listeners = new Map<string, EventListenerCallback[]>();

  return {
    addEventListener(eventName: string, listener: EventListenerCallback) {
      const currentListeners = listeners.get(eventName) || [];
      currentListeners.push(listener);
      listeners.set(eventName, currentListeners);
    },
    removeEventListener(eventName: string, listener: EventListenerCallback) {
      const currentListeners = listeners.get(eventName) || [];
      listeners.set(
        eventName,
        currentListeners.filter((entry) => entry !== listener),
      );
    },
    dispatchMessage(data: unknown) {
      const currentListeners = listeners.get("message") || [];
      currentListeners.forEach((listener) => listener({ data } as unknown as Event));
    },
  };
};

const createRegistration = () => ({
  unregister: vi.fn().mockResolvedValue(true),
});

const originalServiceWorker = navigator.serviceWorker;
const originalCaches = globalThis.caches;

const setMockServiceWorker = (serviceWorker: unknown) => {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: serviceWorker,
  });
};

const setMockCaches = (cacheStorage: unknown) => {
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: cacheStorage,
  });
};

describe("pwa-cleanup", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.sessionStorage.clear();
    setMockServiceWorker(originalServiceWorker);
    setMockCaches(originalCaches);
  });

  it("unregisters service workers, clears caches, and reloads once on public routes", async () => {
    const registrationA = createRegistration();
    const registrationB = createRegistration();
    const serviceWorker = {
      ...createServiceWorkerEventTarget(),
      getRegistrations: vi.fn().mockResolvedValue([registrationA, registrationB]),
      register: vi.fn(),
    };
    const cacheStorage = {
      keys: vi.fn().mockResolvedValue(["public-images-v1", "workbox-precache"]),
      delete: vi.fn().mockResolvedValue(true),
    } as unknown as CacheStorage;
    const reloadSpy = vi.fn();

    setMockServiceWorker(serviceWorker);
    setMockCaches(cacheStorage);

    const result = await runPwaCleanup({
      globalWindow: window,
      globalNavigator: navigator,
      cacheStorage,
      sessionStorage: window.sessionStorage,
      pathname: "/projetos",
      reloadPage: reloadSpy,
    });

    expect(serviceWorker.getRegistrations).toHaveBeenCalledTimes(1);
    expect(registrationA.unregister).toHaveBeenCalledTimes(1);
    expect(registrationB.unregister).toHaveBeenCalledTimes(1);
    expect(cacheStorage.keys).toHaveBeenCalledTimes(1);
    expect(cacheStorage.delete).toHaveBeenCalledTimes(2);
    expect(serviceWorker.register).not.toHaveBeenCalled();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      removedRegistrations: true,
      clearedCaches: true,
      reloaded: true,
    });
  });

  it("does not reload dashboard routes even when cleanup removes legacy state", async () => {
    const registration = createRegistration();
    const serviceWorker = {
      ...createServiceWorkerEventTarget(),
      getRegistrations: vi.fn().mockResolvedValue([registration]),
      register: vi.fn(),
    };
    const cacheStorage = {
      keys: vi.fn().mockResolvedValue(["workbox-precache"]),
      delete: vi.fn().mockResolvedValue(true),
    } as unknown as CacheStorage;
    const reloadSpy = vi.fn();

    setMockServiceWorker(serviceWorker);
    setMockCaches(cacheStorage);

    const result = await runPwaCleanup({
      globalWindow: window,
      globalNavigator: navigator,
      cacheStorage,
      sessionStorage: window.sessionStorage,
      pathname: "/dashboard/posts",
      reloadPage: reloadSpy,
    });

    expect(registration.unregister).toHaveBeenCalledTimes(1);
    expect(cacheStorage.delete).toHaveBeenCalledTimes(1);
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(result.reloaded).toBe(false);
  });

  it("reloads once when the cleanup worker signals a public client", () => {
    const serviceWorker = {
      ...createServiceWorkerEventTarget(),
      getRegistrations: vi.fn().mockResolvedValue([]),
    };
    const reloadSpy = vi.fn();

    setMockServiceWorker(serviceWorker);

    const stopBridge = installPwaCleanupReloadBridge({
      globalWindow: window,
      globalNavigator: navigator,
      sessionStorage: window.sessionStorage,
      pathname: "/",
      reloadPage: reloadSpy,
    });

    serviceWorker.dispatchMessage({ type: "NEKOMATA_SW_CLEANUP_RELOAD" });
    serviceWorker.dispatchMessage({ type: "NEKOMATA_SW_CLEANUP_RELOAD" });

    expect(reloadSpy).toHaveBeenCalledTimes(1);

    stopBridge();
  });
});
