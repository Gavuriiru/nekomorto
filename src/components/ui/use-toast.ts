import type { ReactNode } from "react";
import { toast as sonnerToast } from "sonner";

type ToastVariant = "default" | "destructive";
type ToastIntent = "success" | "error" | "info" | "warning";

type ToastPayload = {
  title?: ReactNode;
  description?: ReactNode;
  variant?: ToastVariant;
  intent?: ToastIntent;
  duration?: number;
};

const resolveIntent = (payload: ToastPayload) => {
  if (payload.intent) {
    return payload.intent;
  }
  if (payload.variant === "destructive") {
    return "error" as const;
  }
  return null;
};

const resolveMessage = (payload: ToastPayload) => {
  if (payload.title !== undefined && payload.title !== null) {
    return payload.title;
  }
  if (payload.description !== undefined && payload.description !== null) {
    return payload.description;
  }
  return "";
};

const toast = (payload: ToastPayload) => {
  const intent = resolveIntent(payload);
  const message = resolveMessage(payload);
  const description = payload.title ? payload.description : undefined;
  const options = {
    description,
    duration: payload.duration,
  };

  if (intent === "success") {
    return sonnerToast.success(message, options);
  }
  if (intent === "error") {
    return sonnerToast.error(message, options);
  }
  if (intent === "info") {
    return sonnerToast.info(message, options);
  }
  if (intent === "warning") {
    return sonnerToast.warning(message, options);
  }
  return sonnerToast(message, options);
};

const useToast = () => ({
  toast,
  dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
  toasts: [],
});

export { useToast, toast };
export type { ToastIntent, ToastPayload, ToastVariant };
