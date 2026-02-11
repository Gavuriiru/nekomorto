import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error";
export type AutosaveSource = "auto" | "manual";

export type UseAutosaveOptions<T> = {
  value: T;
  onSave: (snapshot: T) => Promise<T | void>;
  isReady?: boolean;
  enabled?: boolean;
  debounceMs?: number;
  retryMax?: number;
  retryBaseMs?: number;
  serialize?: (value: T) => string;
  onSaved?: (payload: { source: AutosaveSource; savedAt: number }) => void;
  onError?: (
    error: unknown,
    payload: { source: AutosaveSource; consecutiveErrors: number },
  ) => void;
};

export type UseAutosaveResult = {
  status: AutosaveStatus;
  isDirty: boolean;
  lastSavedAt: number | null;
  error: unknown | null;
  enabled: boolean;
  setEnabled: (nextEnabled: boolean) => void;
  flushNow: () => Promise<boolean>;
};

const defaultSerialize = <T,>(value: T) => {
  if (value === undefined) {
    return "undefined";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const wait = (delayMs: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, Math.max(0, delayMs));
  });

export const useAutosave = <T,>({
  value,
  onSave,
  isReady = true,
  enabled = true,
  debounceMs = 1200,
  retryMax = 2,
  retryBaseMs = 1500,
  serialize = defaultSerialize,
  onSaved,
  onError,
}: UseAutosaveOptions<T>): UseAutosaveResult => {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [error, setError] = useState<unknown | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [isEnabled, setIsEnabled] = useState(Boolean(enabled));

  const serializeValue = useCallback(
    (nextValue: T) => {
      try {
        return serialize(nextValue);
      } catch {
        return defaultSerialize(nextValue);
      }
    },
    [serialize],
  );

  const serializedValue = useMemo(() => serializeValue(value), [serializeValue, value]);

  const latestValueRef = useRef(value);
  const latestSerializedRef = useRef(serializedValue);
  const baselineSerializedRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const queuedDuringSaveRef = useRef(false);
  const enabledRef = useRef(Boolean(enabled));
  const mountedRef = useRef(true);
  const consecutiveErrorsRef = useRef(0);

  latestValueRef.current = value;
  latestSerializedRef.current = serializedValue;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const saveWithRetry = useCallback(
    async (snapshot: T) => {
      let attempt = 0;
      const maxAttempts = Math.max(0, retryMax) + 1;
      while (attempt < maxAttempts) {
        try {
          return await onSave(snapshot);
        } catch (caught) {
          attempt += 1;
          if (attempt >= maxAttempts) {
            throw caught;
          }
          const retryDelay = Math.max(0, retryBaseMs) * 2 ** (attempt - 1);
          await wait(retryDelay);
        }
      }
      throw new Error("autosave_unreachable");
    },
    [onSave, retryBaseMs, retryMax],
  );

  const performSave = useCallback(
    async (source: AutosaveSource): Promise<boolean> => {
      if (!isReady) {
        return false;
      }
      if (source === "auto" && !enabledRef.current) {
        return false;
      }
      clearTimer();

      if (baselineSerializedRef.current === null) {
        baselineSerializedRef.current = latestSerializedRef.current;
        if (mountedRef.current) {
          setStatus("idle");
          setError(null);
        }
        return false;
      }

      if (latestSerializedRef.current === baselineSerializedRef.current) {
        if (mountedRef.current && !inFlightRef.current) {
          setStatus("idle");
          setError(null);
        }
        return true;
      }

      if (inFlightRef.current) {
        queuedDuringSaveRef.current = true;
        if (mountedRef.current) {
          setStatus("pending");
        }
        return false;
      }

      inFlightRef.current = true;
      queuedDuringSaveRef.current = false;
      if (mountedRef.current) {
        setStatus("saving");
        setError(null);
      }

      const snapshot = latestValueRef.current;
      try {
        const savedValue = await saveWithRetry(snapshot);
        const normalizedValue = (savedValue ?? snapshot) as T;
        baselineSerializedRef.current = serializeValue(normalizedValue);
        consecutiveErrorsRef.current = 0;
        const savedAt = Date.now();
        if (mountedRef.current) {
          setLastSavedAt(savedAt);
          setStatus("saved");
          setError(null);
        }
        onSaved?.({ source, savedAt });
      } catch (caught) {
        consecutiveErrorsRef.current += 1;
        if (mountedRef.current) {
          setStatus("error");
          setError(caught);
        }
        onError?.(caught, {
          source,
          consecutiveErrors: consecutiveErrorsRef.current,
        });
      } finally {
        inFlightRef.current = false;
      }

      const shouldFlushQueue =
        queuedDuringSaveRef.current &&
        enabledRef.current &&
        latestSerializedRef.current !== baselineSerializedRef.current;
      queuedDuringSaveRef.current = false;
      if (shouldFlushQueue) {
        void performSave("auto");
      }

      return latestSerializedRef.current === baselineSerializedRef.current;
    },
    [clearTimer, isReady, onError, onSaved, saveWithRetry, serializeValue],
  );

  useEffect(() => {
    if (!isReady) {
      return;
    }
    if (baselineSerializedRef.current === null) {
      baselineSerializedRef.current = latestSerializedRef.current;
      setStatus("idle");
      setError(null);
      consecutiveErrorsRef.current = 0;
      return;
    }

    clearTimer();
    const dirty = latestSerializedRef.current !== baselineSerializedRef.current;
    if (!dirty) {
      if (!inFlightRef.current) {
        setStatus((prev) => (prev === "saved" ? prev : "idle"));
      }
      return;
    }

    if (!isEnabled) {
      if (!inFlightRef.current) {
        setStatus("pending");
      }
      return;
    }

    if (inFlightRef.current) {
      queuedDuringSaveRef.current = true;
      setStatus("pending");
      return;
    }

    setStatus("pending");
    timerRef.current = window.setTimeout(() => {
      void performSave("auto");
    }, Math.max(0, debounceMs));

    return () => {
      clearTimer();
    };
  }, [clearTimer, debounceMs, isEnabled, isReady, performSave, serializedValue]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
    };
  }, [clearTimer]);

  const setEnabled = useCallback((nextEnabled: boolean) => {
    enabledRef.current = Boolean(nextEnabled);
    setIsEnabled(Boolean(nextEnabled));
  }, []);

  useEffect(() => {
    setEnabled(enabled);
  }, [enabled, setEnabled]);

  const isDirty =
    isReady &&
    baselineSerializedRef.current !== null &&
    latestSerializedRef.current !== baselineSerializedRef.current;

  const flushNow = useCallback(async () => performSave("manual"), [performSave]);

  return {
    status,
    isDirty,
    lastSavedAt,
    error,
    enabled: isEnabled,
    setEnabled,
    flushNow,
  };
};
