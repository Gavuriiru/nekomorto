import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type AccessibilityAnnouncerContextValue = {
  announce: (message: string) => void;
};

const noop = () => {};

const AccessibilityAnnouncerContext = createContext<AccessibilityAnnouncerContextValue>({
  announce: noop,
});

export const AccessibilityAnnouncerProvider = ({ children }: { children: ReactNode }) => {
  const [message, setMessage] = useState("");
  const clearTimerRef = useRef<number | null>(null);

  const clearPendingTimer = useCallback(() => {
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
  }, []);

  const announce = useCallback(
    (nextMessage: string) => {
      const normalized = String(nextMessage || "").trim();
      clearPendingTimer();
      setMessage("");
      if (!normalized) {
        return;
      }
      window.requestAnimationFrame(() => {
        setMessage(normalized);
        clearTimerRef.current = window.setTimeout(() => {
          setMessage("");
          clearTimerRef.current = null;
        }, 900);
      });
    },
    [clearPendingTimer],
  );

  useEffect(
    () => () => {
      clearPendingTimer();
    },
    [clearPendingTimer],
  );

  const value = useMemo(
    () => ({
      announce,
    }),
    [announce],
  );

  return (
    <AccessibilityAnnouncerContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only a11y-live-region"
        data-testid="a11y-live-region"
      >
        {message}
      </div>
    </AccessibilityAnnouncerContext.Provider>
  );
};

export const useAccessibilityAnnouncer = () => useContext(AccessibilityAnnouncerContext);
