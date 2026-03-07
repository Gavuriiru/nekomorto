import type { UploadMediaVariantsMap } from "@/lib/upload-variants";
import { normalizePublicPagesConfig } from "@/lib/public-pages";
import {
  emptyPublicBootstrapPayload,
  type PublicBootstrapPayloadMode,
  type PublicBootstrapPayload,
} from "@/types/public-bootstrap";
import type { PublicTeamLinkType, PublicTeamMember } from "@/types/public-team";

export type PublicBootstrapCurrentUser = {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string | null;
  accessRole?: string;
  permissions?: string[];
  ownerIds?: string[];
  primaryOwnerId?: string | null;
  grants?: Partial<Record<string, boolean>>;
};

const normalizePublicBootstrapPayloadMode = (value: unknown): PublicBootstrapPayloadMode =>
  String(value || "").trim() === "critical-home" ? "critical-home" : "full";

export const asPublicBootstrapPayload = (value: unknown): PublicBootstrapPayload | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<PublicBootstrapPayload>;
  if (!Array.isArray(candidate.projects) || !Array.isArray(candidate.posts)) {
    return null;
  }
  return {
    ...emptyPublicBootstrapPayload,
    ...candidate,
    settings: candidate.settings || emptyPublicBootstrapPayload.settings,
    pages: normalizePublicPagesConfig(candidate.pages),
    projects: Array.isArray(candidate.projects) ? candidate.projects : [],
    posts: Array.isArray(candidate.posts) ? candidate.posts : [],
    updates: Array.isArray(candidate.updates) ? candidate.updates : [],
    teamMembers: Array.isArray(candidate.teamMembers)
      ? (candidate.teamMembers as PublicTeamMember[])
      : [],
    teamLinkTypes: Array.isArray(candidate.teamLinkTypes)
      ? (candidate.teamLinkTypes as PublicTeamLinkType[])
      : [],
    mediaVariants:
      candidate.mediaVariants && typeof candidate.mediaVariants === "object"
        ? (candidate.mediaVariants as UploadMediaVariantsMap)
        : {},
    tagTranslations: {
      tags: candidate.tagTranslations?.tags || {},
      genres: candidate.tagTranslations?.genres || {},
      staffRoles: candidate.tagTranslations?.staffRoles || {},
    },
    generatedAt: String(candidate.generatedAt || ""),
    payloadMode: normalizePublicBootstrapPayloadMode(candidate.payloadMode),
  };
};

export const asPublicBootstrapCurrentUser = (
  value: unknown,
): PublicBootstrapCurrentUser | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<PublicBootstrapCurrentUser>;
  const id = String(candidate.id || "").trim();
  if (!id) {
    return null;
  }
  const permissions = Array.isArray(candidate.permissions)
    ? candidate.permissions
        .map((permission) => String(permission || "").trim())
        .filter(Boolean)
    : [];
  const ownerIds = Array.isArray(candidate.ownerIds)
    ? candidate.ownerIds.map((ownerId) => String(ownerId || "").trim()).filter(Boolean)
    : [];
  return {
    id,
    name: String(candidate.name || ""),
    username: String(candidate.username || ""),
    avatarUrl: candidate.avatarUrl ? String(candidate.avatarUrl) : null,
    accessRole: candidate.accessRole ? String(candidate.accessRole) : undefined,
    permissions,
    ownerIds,
    primaryOwnerId: candidate.primaryOwnerId ? String(candidate.primaryOwnerId) : null,
    grants:
      candidate.grants && typeof candidate.grants === "object"
        ? (candidate.grants as Partial<Record<string, boolean>>)
        : undefined,
  };
};

export const readWindowPublicBootstrap = () => {
  if (typeof window === "undefined") {
    return null;
  }
  const globalWindow = window as Window & {
    __BOOTSTRAP_PUBLIC__?: unknown;
  };
  return asPublicBootstrapPayload(globalWindow.__BOOTSTRAP_PUBLIC__);
};

export const readWindowPublicBootstrapCurrentUser = () => {
  if (typeof window === "undefined") {
    return null;
  }
  const globalWindow = window as Window & {
    __BOOTSTRAP_PUBLIC_ME__?: unknown;
  };
  return asPublicBootstrapCurrentUser(globalWindow.__BOOTSTRAP_PUBLIC_ME__);
};
