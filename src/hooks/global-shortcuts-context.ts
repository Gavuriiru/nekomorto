import { createContext } from "react";

export type GlobalShortcutsContextValue = {
  setDashboardHrefResolver: (resolver: (() => string) | null) => void;
  setOpenSearchAction: (action: (() => void) | null) => void;
};

export const GlobalShortcutsContext = createContext<GlobalShortcutsContextValue>({
  setDashboardHrefResolver: () => undefined,
  setOpenSearchAction: () => undefined,
});
