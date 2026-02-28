import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { GlobalShortcutsContext } from "@/hooks/global-shortcuts-context";
import { isEditableShortcutTarget, isSearchShortcutBlockedTarget } from "@/lib/keyboard-shortcuts";

const DASHBOARD_CHORD_TIMEOUT_MS = 800;

export const GlobalShortcutsProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const openSearchActionRef = useRef<(() => void) | null>(null);
  const dashboardHrefResolverRef = useRef<(() => string) | null>(null);
  const isDashboardChordArmedRef = useRef(false);
  const dashboardChordTimerRef = useRef<number | null>(null);

  const clearDashboardChord = useCallback(() => {
    isDashboardChordArmedRef.current = false;
    if (dashboardChordTimerRef.current !== null) {
      window.clearTimeout(dashboardChordTimerRef.current);
      dashboardChordTimerRef.current = null;
    }
  }, []);

  const armDashboardChord = useCallback(() => {
    clearDashboardChord();
    isDashboardChordArmedRef.current = true;
    dashboardChordTimerRef.current = window.setTimeout(() => {
      clearDashboardChord();
    }, DASHBOARD_CHORD_TIMEOUT_MS);
  }, [clearDashboardChord]);

  const setOpenSearchAction = useCallback((action: (() => void) | null) => {
    openSearchActionRef.current = action;
  }, []);

  const setDashboardHrefResolver = useCallback((resolver: (() => string) | null) => {
    dashboardHrefResolverRef.current = resolver;
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) {
        return;
      }

      const key = String(event.key || "").toLowerCase();
      const hasModifier = event.metaKey || event.ctrlKey || event.altKey;

      if (!hasModifier && key === "/") {
        if (!openSearchActionRef.current || isSearchShortcutBlockedTarget(event.target)) {
          return;
        }
        event.preventDefault();
        clearDashboardChord();
        openSearchActionRef.current();
        return;
      }

      if (isEditableShortcutTarget(event.target)) {
        if (isDashboardChordArmedRef.current && key !== "g") {
          clearDashboardChord();
        }
        return;
      }

      if (hasModifier || event.shiftKey) {
        if (isDashboardChordArmedRef.current && key !== "g") {
          clearDashboardChord();
        }
        return;
      }

      if (key === "g") {
        armDashboardChord();
        return;
      }

      if (key === "d" && isDashboardChordArmedRef.current) {
        event.preventDefault();
        const href = dashboardHrefResolverRef.current?.() || "/dashboard";
        clearDashboardChord();
        navigate(href);
        return;
      }

      if (isDashboardChordArmedRef.current) {
        clearDashboardChord();
      }
    };

    const handleWindowBlur = () => {
      clearDashboardChord();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleWindowBlur);
      clearDashboardChord();
    };
  }, [armDashboardChord, clearDashboardChord, navigate]);

  const value = useMemo(
    () => ({
      setDashboardHrefResolver,
      setOpenSearchAction,
    }),
    [setDashboardHrefResolver, setOpenSearchAction],
  );

  return (
    <GlobalShortcutsContext.Provider value={value}>{children}</GlobalShortcutsContext.Provider>
  );
};

export default GlobalShortcutsProvider;
