import { createContext } from "react";
import {
  readWindowPublicBootstrapCurrentUser,
  type PublicBootstrapCurrentUser,
} from "@/lib/public-bootstrap-global";

export type DashboardSessionUser = PublicBootstrapCurrentUser & {
  email?: string | null;
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
