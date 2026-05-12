import { createContext, type ReactNode, useContext, useMemo } from "react";

import {
  asPublicBootstrapCurrentUser,
  asPublicBootstrapPayload,
  readWindowPublicBootstrap,
  readWindowPublicBootstrapCurrentUser,
  type PublicBootstrapCurrentUser,
} from "@/lib/public-bootstrap-global";
import type { PublicBootstrapPayload } from "@/types/public-bootstrap";

type PublicBootstrapContextValue = {
  currentUser: PublicBootstrapCurrentUser | null;
  publicBootstrap: PublicBootstrapPayload | null;
};

const PublicBootstrapContext = createContext<PublicBootstrapContextValue | null>(null);

const normalizeInitialBootstrap = (value: unknown) =>
  asPublicBootstrapPayload(value) || readWindowPublicBootstrap();

const normalizeInitialCurrentUser = (value: unknown) =>
  asPublicBootstrapCurrentUser(value) || readWindowPublicBootstrapCurrentUser();

export const PublicBootstrapProvider = ({
  children,
  initialCurrentUser,
  initialPublicBootstrap,
}: {
  children: ReactNode;
  initialCurrentUser?: unknown;
  initialPublicBootstrap?: unknown;
}) => {
  const value = useMemo(
    () => ({
      currentUser: normalizeInitialCurrentUser(initialCurrentUser),
      publicBootstrap: normalizeInitialBootstrap(initialPublicBootstrap),
    }),
    [initialCurrentUser, initialPublicBootstrap],
  );

  return <PublicBootstrapContext.Provider value={value}>{children}</PublicBootstrapContext.Provider>;
};

export const useResolvedPublicBootstrap = () => {
  const context = useContext(PublicBootstrapContext);
  return context?.publicBootstrap || readWindowPublicBootstrap();
};

export const useResolvedPublicBootstrapCurrentUser = () => {
  const context = useContext(PublicBootstrapContext);
  return context?.currentUser || readWindowPublicBootstrapCurrentUser();
};
