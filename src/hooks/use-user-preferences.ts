import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { emptyUserPreferences, type UiListState, type UserPreferences } from "@/types/user-preferences";

const USER_PREFERENCES_SCREEN_KEY_PATTERN = /^[a-z0-9._-]{1,80}$/i;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeUiListState = (value: unknown): UiListState => {
  if (!isPlainObject(value)) {
    return {};
  }
  const normalized: UiListState = {};

  if (typeof value.sort === "string" && value.sort.trim()) {
    normalized.sort = value.sort.trim().slice(0, 64);
  }

  const page = Number(value.page);
  if (Number.isFinite(page) && page >= 1) {
    normalized.page = Math.min(Math.floor(page), 9999);
  }

  if (Array.isArray(value.columns)) {
    normalized.columns = Array.from(
      new Set(
        value.columns
          .map((entry) => String(entry || "").trim().slice(0, 64))
          .filter(Boolean),
      ),
    ).slice(0, 30);
  }

  if (isPlainObject(value.filters)) {
    const filters: NonNullable<UiListState["filters"]> = {};
    Object.entries(value.filters)
      .slice(0, 40)
      .forEach(([key, rawValue]) => {
        const normalizedKey = String(key || "").trim().slice(0, 64);
        if (!normalizedKey) {
          return;
        }
        if (
          rawValue === null ||
          typeof rawValue === "string" ||
          typeof rawValue === "number" ||
          typeof rawValue === "boolean"
        ) {
          filters[normalizedKey] = rawValue;
          return;
        }
        if (Array.isArray(rawValue)) {
          filters[normalizedKey] = rawValue
            .slice(0, 20)
            .filter(
              (entry) =>
                entry === null ||
                typeof entry === "string" ||
                typeof entry === "number" ||
                typeof entry === "boolean",
            );
        }
      });
    if (Object.keys(filters).length > 0) {
      normalized.filters = filters;
    }
  }

  return normalized;
};

const normalizeUserPreferences = (value: unknown): UserPreferences => {
  if (!isPlainObject(value)) {
    return { ...emptyUserPreferences };
  }

  const normalized: UserPreferences = {};
  const themeMode = String(value.themeMode || "").trim().toLowerCase();
  if (themeMode === "light" || themeMode === "dark" || themeMode === "system") {
    normalized.themeMode = themeMode;
  }

  const density = String(value.density || "").trim().toLowerCase();
  if (density === "comfortable" || density === "compact") {
    normalized.density = density;
  }

  if (isPlainObject(value.uiListState)) {
    const nextUiListState: Record<string, UiListState> = {};
    Object.entries(value.uiListState)
      .slice(0, 80)
      .forEach(([screenKey, screenState]) => {
        const normalizedKey = String(screenKey || "").trim();
        if (!USER_PREFERENCES_SCREEN_KEY_PATTERN.test(normalizedKey)) {
          return;
        }
        const normalizedState = normalizeUiListState(screenState);
        if (Object.keys(normalizedState).length > 0) {
          nextUiListState[normalizedKey] = normalizedState;
        }
      });
    normalized.uiListState = nextUiListState;
  } else {
    normalized.uiListState = {};
  }

  return normalized;
};

type PreferencesUpdater = UserPreferences | ((previous: UserPreferences) => UserPreferences);

export const useUserPreferences = () => {
  const apiBase = getApiBase();
  const [preferences, setPreferences] = useState<UserPreferences>({ ...emptyUserPreferences });
  const [hasLoaded, setHasLoaded] = useState(false);
  const [canPersist, setCanPersist] = useState(false);
  const lastPersistedRef = useRef(JSON.stringify(emptyUserPreferences));

  useEffect(() => {
    let isActive = true;
    const loadPreferences = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/me/preferences", { auth: true });
        if (!response.ok) {
          if (isActive) {
            setCanPersist(false);
            setHasLoaded(true);
          }
          return;
        }
        const payload = (await response.json()) as { preferences?: unknown };
        const normalized = normalizeUserPreferences(payload?.preferences);
        if (isActive) {
          setPreferences(normalized);
          setCanPersist(true);
          setHasLoaded(true);
          lastPersistedRef.current = JSON.stringify(normalized);
        }
      } catch {
        if (isActive) {
          setCanPersist(false);
          setHasLoaded(true);
        }
      }
    };
    void loadPreferences();
    return () => {
      isActive = false;
    };
  }, [apiBase]);

  useEffect(() => {
    if (!hasLoaded || !canPersist) {
      return;
    }
    const normalized = normalizeUserPreferences(preferences);
    const serialized = JSON.stringify(normalized);
    if (serialized === lastPersistedRef.current) {
      return;
    }
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await apiFetch(apiBase, "/api/me/preferences", {
            method: "PUT",
            auth: true,
            json: { preferences: normalized },
          });
          if (!response.ok) {
            if (response.status === 401 || response.status === 403 || response.status === 404) {
              setCanPersist(false);
            }
            return;
          }
          const payload = (await response.json()) as { preferences?: unknown };
          const saved = normalizeUserPreferences(payload?.preferences || normalized);
          const savedSerialized = JSON.stringify(saved);
          lastPersistedRef.current = savedSerialized;
          setPreferences((previous) => {
            const previousSerialized = JSON.stringify(normalizeUserPreferences(previous));
            if (previousSerialized === savedSerialized) {
              return previous;
            }
            return saved;
          });
        } catch {
          // Ignore network failures and try again on future changes.
        }
      })();
    }, 320);
    return () => window.clearTimeout(timeout);
  }, [apiBase, canPersist, hasLoaded, preferences]);

  const updatePreferences = useCallback((updater: PreferencesUpdater) => {
    setPreferences((previous) => {
      const nextValue = typeof updater === "function" ? updater(previous) : updater;
      return normalizeUserPreferences(nextValue);
    });
  }, []);

  const getUiListState = useCallback(
    (screenKey: string): UiListState | null => {
      const normalizedKey = String(screenKey || "").trim();
      if (!USER_PREFERENCES_SCREEN_KEY_PATTERN.test(normalizedKey)) {
        return null;
      }
      const value = preferences.uiListState?.[normalizedKey];
      if (!value || typeof value !== "object") {
        return null;
      }
      return normalizeUiListState(value);
    },
    [preferences.uiListState],
  );

  const setUiListState = useCallback((screenKey: string, state: UiListState | null) => {
    const normalizedKey = String(screenKey || "").trim();
    if (!USER_PREFERENCES_SCREEN_KEY_PATTERN.test(normalizedKey)) {
      return;
    }
    setPreferences((previous) => {
      const base = normalizeUserPreferences(previous);
      const nextUiListState = { ...(base.uiListState || {}) };
      const normalizedState = normalizeUiListState(state);
      if (Object.keys(normalizedState).length === 0) {
        delete nextUiListState[normalizedKey];
      } else {
        nextUiListState[normalizedKey] = normalizedState;
      }
      const nextPreferences = {
        ...base,
        uiListState: nextUiListState,
      };
      const previousSerialized = JSON.stringify(base);
      const nextSerialized = JSON.stringify(nextPreferences);
      if (previousSerialized === nextSerialized) {
        return previous;
      }
      return nextPreferences;
    });
  }, []);

  const uiListState = useMemo(() => preferences.uiListState || {}, [preferences.uiListState]);

  return {
    preferences,
    uiListState,
    hasLoaded,
    canPersist,
    updatePreferences,
    getUiListState,
    setUiListState,
  };
};
