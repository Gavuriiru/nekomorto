import { useEffect, useRef } from "react";

import { dismissToast, type ToastIntent, toast } from "@/components/ui/use-toast";

const PERSISTENT_TOAST_DURATION_MS = 86_400_000;

type DashboardRefreshToastOptions = {
  active: boolean;
  title: string;
  description?: string;
  intent?: ToastIntent;
};

type RefreshToastState = {
  id: string | number | null;
  key: string;
  open: boolean;
};

const EMPTY_TOAST_STATE: RefreshToastState = {
  id: null,
  key: "",
  open: false,
};

export const useDashboardRefreshToast = ({
  active,
  title,
  description,
  intent = "info",
}: DashboardRefreshToastOptions) => {
  const stateRef = useRef<RefreshToastState>(EMPTY_TOAST_STATE);

  useEffect(() => {
    const nextKey = `${title}::${description ?? ""}::${intent}`;

    if (!active) {
      if (stateRef.current.open && stateRef.current.id !== null) {
        dismissToast(stateRef.current.id);
      }
      stateRef.current = EMPTY_TOAST_STATE;
      return;
    }

    if (stateRef.current.open && stateRef.current.key === nextKey) {
      return;
    }

    if (stateRef.current.open && stateRef.current.id !== null) {
      dismissToast(stateRef.current.id);
    }

    const nextToastId = toast({
      title,
      description,
      intent,
      duration: PERSISTENT_TOAST_DURATION_MS,
    });

    stateRef.current = {
      id: typeof nextToastId === "string" || typeof nextToastId === "number" ? nextToastId : null,
      key: nextKey,
      open: true,
    };
  }, [active, description, intent, title]);

  useEffect(() => {
    return () => {
      if (stateRef.current.open && stateRef.current.id !== null) {
        dismissToast(stateRef.current.id);
      }
      stateRef.current = EMPTY_TOAST_STATE;
    };
  }, []);
};
