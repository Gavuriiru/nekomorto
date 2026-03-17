import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetPwaRegisterForTests, registerPwa } from "@/lib/pwa-register";

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

describe("pwa-register", () => {
  beforeEach(() => {
    __resetPwaRegisterForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    __resetPwaRegisterForTests();
    setMockServiceWorker(originalServiceWorker);
  });

  it("returns null when service worker support is unavailable", async () => {
    setMockServiceWorker(undefined);

    await expect(registerPwa()).resolves.toBeNull();
  });

  it("registers the service worker once and reuses the same promise", async () => {
    const registration = {
      ...createEventTarget(),
      waiting: null,
      installing: null,
      update: vi.fn().mockResolvedValue(undefined),
    };
    const serviceWorker = {
      ...createEventTarget(),
      controller: null,
      ready: Promise.resolve(registration),
      register: vi.fn().mockResolvedValue(registration),
    };
    setMockServiceWorker(serviceWorker);

    const firstRegistration = registerPwa();
    const secondRegistration = registerPwa();

    const [firstHandle, secondHandle] = await Promise.all([firstRegistration, secondRegistration]);

    expect(serviceWorker.register).toHaveBeenCalledTimes(1);
    expect(serviceWorker.register).toHaveBeenCalledWith("/sw.js");
    expect(registration.update).toHaveBeenCalledTimes(1);
    expect(firstHandle).toBe(secondHandle);
  });

  it("calls onNeedRefresh when a waiting worker already exists", async () => {
    const waitingWorker = {
      postMessage: vi.fn(),
    };
    const registration = {
      ...createEventTarget(),
      waiting: waitingWorker,
      installing: null,
      update: vi.fn().mockResolvedValue(undefined),
    };
    const serviceWorker = {
      ...createEventTarget(),
      controller: {},
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
    const registration = {
      ...createEventTarget(),
      waiting: null,
      installing: null,
      update: vi.fn().mockResolvedValue(undefined),
    };
    const serviceWorker = {
      ...createEventTarget(),
      controller: null,
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
