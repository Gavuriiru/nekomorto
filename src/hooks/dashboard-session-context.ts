import type { PublicBootstrapCurrentUser } from "@/lib/public-bootstrap-global";
import { createContext } from "react";

export type DashboardBootstrapUser = Pick<
  PublicBootstrapCurrentUser,
  "id" | "name" | "username" | "avatarUrl" | "revision"
>;

export type DashboardSessionAuthMethod = {
  provider: string;
  linked: boolean;
  hasPasskey?: boolean;
  emailNormalized?: string | null;
  emailVerified?: boolean;
};

export type DashboardSessionUser = DashboardBootstrapUser & {
  email?: string | null;
  authMethods?: DashboardSessionAuthMethod[];
  accessRole?: string;
  permissions?: string[];
  ownerIds?: string[];
  primaryOwnerId?: string | null;
  grants?: Partial<Record<string, boolean>>;
};

export type DashboardSessionContextValue = {
  hasProvider: boolean;
  currentUser: DashboardSessionUser | null;
  isLoading: boolean;
  hasResolved: boolean;
  refresh: (options?: { background?: boolean }) => Promise<DashboardSessionUser | null>;
  setCurrentUser: (user: DashboardSessionUser | null) => void;
};

export const readDashboardBootstrapUser = (): DashboardBootstrapUser | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const candidate = (window as Window & { __BOOTSTRAP_PUBLIC_ME__?: unknown })
    .__BOOTSTRAP_PUBLIC_ME__;
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const id = String((candidate as { id?: unknown }).id || "").trim();
  if (!id) {
    return null;
  }

  const name = String((candidate as { name?: unknown }).name || "").trim();
  const username = String((candidate as { username?: unknown }).username || "").trim();
  const avatarUrl = (candidate as { avatarUrl?: unknown }).avatarUrl;
  const revision = (candidate as { revision?: unknown }).revision;

  return {
    id,
    name,
    username,
    avatarUrl: typeof avatarUrl === "string" ? avatarUrl || null : null,
    revision: typeof revision === "string" ? revision || null : null,
  };
};

const bootstrapUser = readDashboardBootstrapUser();

export const DashboardSessionContext = createContext<DashboardSessionContextValue>({
  hasProvider: false,
  currentUser: bootstrapUser,
  isLoading: Boolean(bootstrapUser),
  hasResolved: false,
  refresh: async () => null,
  setCurrentUser: () => undefined,
});
