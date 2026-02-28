import { useContext, useEffect } from "react";
import { GlobalShortcutsContext } from "@/hooks/global-shortcuts-context";

type GlobalShortcutRegistration = {
  getDashboardHref?: (() => string) | null;
  onOpenSearch?: (() => void) | null;
};

export const useGlobalShortcuts = ({
  getDashboardHref = null,
  onOpenSearch = null,
}: GlobalShortcutRegistration) => {
  const { setDashboardHrefResolver, setOpenSearchAction } = useContext(GlobalShortcutsContext);

  useEffect(() => {
    setOpenSearchAction(onOpenSearch);
    return () => {
      setOpenSearchAction(null);
    };
  }, [onOpenSearch, setOpenSearchAction]);

  useEffect(() => {
    setDashboardHrefResolver(getDashboardHref);
    return () => {
      setDashboardHrefResolver(null);
    };
  }, [getDashboardHref, setDashboardHrefResolver]);
};
