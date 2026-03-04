import type { UploadMediaVariantsMap } from "@/lib/upload-variants";
import { normalizePublicPagesConfig } from "@/lib/public-pages";
import {
  emptyPublicBootstrapPayload,
  type PublicBootstrapPayload,
} from "@/types/public-bootstrap";

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
