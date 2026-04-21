import { GlobalShortcutsContext } from "@/hooks/global-shortcuts-context";
import { useContext, useEffect } from "react";

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
    if (!onOpenSearch) {
      return;
    }
    setOpenSearchAction(onOpenSearch);
    return () => {
      setOpenSearchAction(null);
    };
  }, [onOpenSearch, setOpenSearchAction]);

  useEffect(() => {
    if (!getDashboardHref) {
      return;
    }
    setDashboardHrefResolver(getDashboardHref);
    return () => {
      setDashboardHrefResolver(null);
    };
  }, [getDashboardHref, setDashboardHrefResolver]);
};
