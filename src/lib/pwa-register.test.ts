import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetPwaRegisterForTests,
  __setPwaReloadForTests,
  registerPwa,
} from "@/lib/pwa-register";

type EventCallback = () => void;

const createEventTarget = () => {
  const listeners = new Map<string, EventCallback[]>();

  return {
    addEventListener(eventName: string, listener: EventCallback) {
      const currentListeners = listeners.get(eventName) || [];
      currentListeners.push(listener);
      listeners.set(eventName, currentListeners);
    },
    dispatch(eventName: string) {
      const currentListeners = listeners.get(eventName) || [];
      currentListeners.forEach((listener) => listener());
    },
  };
};

const originalServiceWorker = navigator.serviceWorker;

const setMockServiceWorker = (serviceWorker: unknown) => {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: serviceWorker,
  });
};

const createRegistration = ({
  activeScriptUrl = null,
  waiting = null,
  installing = null,
}: {
  activeScriptUrl?: string | null;
  waiting?: { postMessage?: ReturnType<typeof vi.fn> } | null;
  installing?: ReturnType<typeof createEventTarget> & { state?: string } | null;
} = {}) => ({
  ...createEventTarget(),
  active: activeScriptUrl ? { scriptURL: activeScriptUrl } : null,
  waiting,
  installing,
  unregister: vi.fn().mockResolvedValue(true),
  update: vi.fn().mockResolvedValue(undefined),
});

describe("pwa-register", () => {
  beforeEach(() => {
    __resetPwaRegisterForTests();
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    __resetPwaRegisterForTests();
    setMockServiceWorker(originalServiceWorker);
    window.sessionStorage.clear();
  });

  it("returns null when service worker support is unavailable", async () => {
    setMockServiceWorker(undefined);

    await expect(registerPwa()).resolves.toBeNull();
  });

  it("registers the service worker once and reuses the same promise", async () => {
    const healthyExistingRegistration = createRegistration({
      activeScriptUrl: "https://nekomata.test/sw.js",
    });
    const registration = createRegistration();
    const serviceWorker = {
      ...createEventTarget(),
      controller: null,
      getRegistrations: vi.fn().mockResolvedValue([healthyExistingRegistration]),
      ready: Promise.resolve(registration),
      register: vi.fn().mockResolvedValue(registration),
    };
    setMockServiceWorker(serviceWorker);

    const firstRegistration = registerPwa();
    const secondRegistration = registerPwa();

    const [firstHandle, secondHandle] = await Promise.all([firstRegistration, secondRegistration]);

    expect(serviceWorker.register).toHaveBeenCalledTimes(1);
    expect(serviceWorker.register).toHaveBeenCalledWith("/sw.js");
    expect(serviceWorker.getRegistrations).toHaveBeenCalledTimes(1);
    expect(healthyExistingRegistration.unregister).not.toHaveBeenCalled();
    expect(registration.update).toHaveBeenCalledTimes(1);
    expect(firstHandle).toBe(secondHandle);
  });

  it("unregisters legacy vite-plugin-pwa registrations and reloads once before registering the current worker", async () => {
    const legacyRegistration = createRegistration({
      activeScriptUrl: "https://nekomata.test/@vite-plugin-pwa/dev-sw.js?dev-sw",
    });
    const registration = createRegistration();
    const serviceWorker = {
      ...createEventTarget(),
      controller: null,
      getRegistrations: vi.fn().mockResolvedValue([legacyRegistration]),
      ready: Promise.resolve(registration),
      register: vi.fn().mockResolvedValue(registration),
    };
    setMockServiceWorker(serviceWorker);
    const reloadSpy = vi.fn();
    __setPwaReloadForTests(reloadSpy);

    await expect(registerPwa()).resolves.toBeNull();

    expect(legacyRegistration.unregister).toHaveBeenCalledTimes(1);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(serviceWorker.register).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("nekomata:pwa-legacy-cleanup-reloaded")).toBe("true");
  });

  it("does not reload in a loop when the cleanup sentinel is already set", async () => {
    window.sessionStorage.setItem("nekomata:pwa-legacy-cleanup-reloaded", "true");
    const legacyRegistration = createRegistration({
      activeScriptUrl: "https://nekomata.test/sw.js?dev-sw",
    });
    const registration = createRegistration();
    const serviceWorker = {
      ...createEventTarget(),
      controller: null,
      getRegistrations: vi.fn().mockResolvedValue([legacyRegistration]),
      ready: Promise.resolve(registration),
      register: vi.fn().mockResolvedValue(registration),
    };
    setMockServiceWorker(serviceWorker);
    const reloadSpy = vi.fn();
    __setPwaReloadForTests(reloadSpy);

    const handle = await registerPwa();

    expect(legacyRegistration.unregister).toHaveBeenCalledTimes(1);
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(serviceWorker.register).toHaveBeenCalledTimes(1);
    expect(serviceWorker.register).toHaveBeenCalledWith("/sw.js");
    expect(handle).not.toBeNull();
  });

  it("calls onNeedRefresh when a waiting worker already exists", async () => {
    const waitingWorker = {
      postMessage: vi.fn(),
    };
    const registration = createRegistration({
      waiting: waitingWorker,
    });
    const serviceWorker = {
      ...createEventTarget(),
      controller: {},
      getRegistrations: vi.fn().mockResolvedValue([]),
      ready: Promise.resolve(registration),
      register: vi.fn().mockResolvedValue(registration),
    };
    setMockServiceWorker(serviceWorker);
    const onNeedRefresh = vi.fn();

    await registerPwa({ onNeedRefresh });

    expect(onNeedRefresh).toHaveBeenCalledTimes(1);
    const applyUpdate = onNeedRefresh.mock.calls[0]?.[0];
    expect(typeof applyUpdate).toBe("function");

    await applyUpdate();

    expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("calls onOfflineReady when the page becomes ready without forcing an update", async () => {
    const registration = createRegistration();
    const serviceWorker = {
      ...createEventTarget(),
      controller: null,
      getRegistrations: vi.fn().mockResolvedValue([]),
      ready: Promise.resolve(registration),
      register: vi.fn().mockResolvedValue(registration),
    };
    setMockServiceWorker(serviceWorker);
    const onOfflineReady = vi.fn();

    await registerPwa({ immediate: false, onOfflineReady });
    await Promise.resolve();

    expect(registration.update).not.toHaveBeenCalled();
    expect(onOfflineReady).toHaveBeenCalledTimes(1);
  });
});
