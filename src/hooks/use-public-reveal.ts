import { useEffect } from "react";

import { usePublicDocumentLocation } from "@/lib/public-document-navigation";
import { clearSkipRouteMotion, consumePopstate } from "@/lib/route-motion";

const DEFAULT_SELECTOR = "[data-reveal]";

const instantlyRevealAll = (selector: string) => {
  const elements = document.querySelectorAll<HTMLElement>(selector);
  elements.forEach((element) => {
    element.classList.add("reveal-visible");
    element.classList.remove("reveal-hidden");
  });
};

export const usePublicReveal = ({
  enabled = true,
  initialPath = "/",
  selector = DEFAULT_SELECTOR,
}: {
  enabled?: boolean;
  initialPath?: string;
  selector?: string;
}) => {
  const location = usePublicDocumentLocation(initialPath);
  const routeKey = `${location.pathname || "/"}${location.search || ""}`;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (consumePopstate()) {
      instantlyRevealAll(selector);
      return;
    }

    clearSkipRouteMotion();
    instantlyRevealAll(selector);

    const mutationObserver = new MutationObserver(() => {
      instantlyRevealAll(selector);
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutationObserver.disconnect();
    };
  }, [enabled, routeKey, selector]);
};

export default usePublicReveal;
