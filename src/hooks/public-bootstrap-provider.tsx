import { createContext, type ReactNode, useContext, useMemo } from "react";

import {
  asPublicBootstrapCurrentUser,
  asPublicBootstrapPayload,
  asPublicRoutePayload,
  readWindowPublicBootstrap,
  readWindowPublicBootstrapCurrentUser,
  readWindowPublicRoutePayload,
  type PublicBootstrapCurrentUser,
} from "@/lib/public-bootstrap-global";
import type { PublicBootstrapPayload, PublicRoutePayload } from "@/types/public-bootstrap";

type PublicBootstrapContextValue = {
  currentUser: PublicBootstrapCurrentUser | null;
  publicBootstrap: PublicBootstrapPayload | null;
  publicRoutePayload: PublicRoutePayload | null;
};

const PublicBootstrapContext = createContext<PublicBootstrapContextValue | null>(null);

const normalizeInitialBootstrap = (value: unknown) =>
  asPublicBootstrapPayload(value) || readWindowPublicBootstrap();

const normalizeInitialRoutePayload = (value: unknown) =>
  asPublicRoutePayload(value) || readWindowPublicRoutePayload();

const normalizeInitialCurrentUser = (value: unknown) =>
  asPublicBootstrapCurrentUser(value) || readWindowPublicBootstrapCurrentUser();

export const PublicBootstrapProvider = ({
  children,
  initialCurrentUser,
  initialPublicBootstrap,
  initialPublicRoutePayload,
}: {
  children: ReactNode;
  initialCurrentUser?: unknown;
  initialPublicBootstrap?: unknown;
  initialPublicRoutePayload?: unknown;
}) => {
  const value = useMemo(
    () => ({
      currentUser: normalizeInitialCurrentUser(initialCurrentUser),
      publicBootstrap: normalizeInitialBootstrap(initialPublicBootstrap),
      publicRoutePayload: normalizeInitialRoutePayload(initialPublicRoutePayload),
    }),
    [initialCurrentUser, initialPublicBootstrap, initialPublicRoutePayload],
  );

  return (
    <PublicBootstrapContext.Provider value={value}>{children}</PublicBootstrapContext.Provider>
  );
};

export const useResolvedPublicBootstrap = () => {
  const context = useContext(PublicBootstrapContext);
  return context?.publicBootstrap || readWindowPublicBootstrap();
};

export const useResolvedPublicRoutePayload = () => {
  const context = useContext(PublicBootstrapContext);
  return context?.publicRoutePayload || readWindowPublicRoutePayload();
};

export const useResolvedPublicBootstrapCurrentUser = () => {
  const context = useContext(PublicBootstrapContext);
  return context?.currentUser || readWindowPublicBootstrapCurrentUser();
};
