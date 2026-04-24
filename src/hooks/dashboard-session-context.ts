import {
  type PublicBootstrapCurrentUser,
  readWindowPublicBootstrapCurrentUser,
} from "@/lib/public-bootstrap-global";
import { createContext } from "react";

export type DashboardSessionAuthMethod = {
  provider: string;
  linked: boolean;
  hasPasskey?: boolean;
  emailNormalized?: string | null;
  emailVerified?: boolean;
};

export type DashboardSessionUser = PublicBootstrapCurrentUser & {
  email?: string | null;
  authMethods?: DashboardSessionAuthMethod[];
};

export type DashboardSessionContextValue = {
  hasProvider: boolean;
  currentUser: DashboardSessionUser | null;
  isLoading: boolean;
  hasResolved: boolean;
  refresh: (options?: { background?: boolean }) => Promise<DashboardSessionUser | null>;
  setCurrentUser: (user: DashboardSessionUser | null) => void;
};

const bootstrapUser = readWindowPublicBootstrapCurrentUser() as DashboardSessionUser | null;

export const DashboardSessionContext = createContext<DashboardSessionContextValue>({
  hasProvider: false,
  currentUser: bootstrapUser,
  isLoading: false,
  hasResolved: Boolean(bootstrapUser),
  refresh: async () => bootstrapUser,
  setCurrentUser: () => undefined,
});
