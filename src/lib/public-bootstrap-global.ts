import { normalizePublicPagesConfig } from "@/lib/public-pages";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";
import {
  emptyPublicBootstrapPayload,
  type PublicBootstrapHomeHero,
  type PublicBootstrapHomeHeroSlide,
  type PublicBootstrapPayload,
  type PublicBootstrapPayloadMode,
  type PublicBootstrapPostDetail,
} from "@/types/public-bootstrap";
import type { PublicTeamLinkType, PublicTeamMember } from "@/types/public-team";

export type PublicBootstrapCurrentUser = {
  id: string;
  name: string;
  username: string;
  email?: string | null;
  avatarUrl?: string | null;
  revision?: string | null;
  accessRole?: string;
  permissions?: string[];
  ownerIds?: string[];
  primaryOwnerId?: string | null;
  grants?: Partial<Record<string, boolean>>;
};

const normalizePublicBootstrapPayloadMode = (value: unknown): PublicBootstrapPayloadMode =>
  String(value || "").trim() === "critical-home" ? "critical-home" : "full";

const normalizePublicBootstrapPostDetail = (value: unknown): PublicBootstrapPostDetail | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<PublicBootstrapPostDetail>;
  const id = String(candidate.id || "").trim();
  const slug = String(candidate.slug || "").trim();
  if (!id || !slug) {
    return null;
  }
  return {
    id,
    slug,
    title: String(candidate.title || ""),
    excerpt: String(candidate.excerpt || ""),
    author: String(candidate.author || ""),
    publishedAt: String(candidate.publishedAt || ""),
    coverImageUrl: String(candidate.coverImageUrl || ""),
    coverAlt: String(candidate.coverAlt || ""),
    projectId: String(candidate.projectId || ""),
    tags: Array.isArray(candidate.tags)
      ? candidate.tags.map((tag) => String(tag || "").trim()).filter(Boolean)
      : [],
    views: Number.isFinite(Number(candidate.views)) ? Number(candidate.views) : 0,
    commentsCount: Number.isFinite(Number(candidate.commentsCount)) ? Number(candidate.commentsCount) : 0,
    content: String(candidate.content || ""),
    contentFormat: candidate.contentFormat === "lexical" ? "lexical" : undefined,
    seoTitle: candidate.seoTitle ? String(candidate.seoTitle) : null,
    seoDescription: candidate.seoDescription ? String(candidate.seoDescription) : null,
  };
};

const normalizePublicBootstrapHomeHero = (value: unknown): PublicBootstrapHomeHero | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<PublicBootstrapHomeHero>;
  const slides = Array.isArray(candidate.slides)
    ? candidate.slides
        .map((slide) => {
          if (!slide || typeof slide !== "object") {
            return null;
          }
          const safeSlide = slide as Partial<PublicBootstrapHomeHeroSlide>;
          const id = String(safeSlide.id || "").trim();
          const image = String(safeSlide.image || "").trim();
          const projectId = String(safeSlide.projectId || "").trim();
          if (!id || !image || !projectId) {
            return null;
          }
          return {
            id,
            title: String(safeSlide.title || ""),
            description: String(safeSlide.description || ""),
            updatedAt: String(safeSlide.updatedAt || ""),
            image,
            projectId,
            trailerUrl: String(safeSlide.trailerUrl || ""),
            format: String(safeSlide.format || ""),
            status: String(safeSlide.status || ""),
          } satisfies PublicBootstrapHomeHeroSlide;
        })
        .filter(Boolean)
    : [];
  if (slides.length === 0) {
    return null;
  }
  const normalizedSlides = slides as PublicBootstrapHomeHeroSlide[];
  const fallbackSlideId = normalizedSlides[0]?.id || "";
  const initialSlideId = String(candidate.initialSlideId || fallbackSlideId).trim();
  const latestSlideId = String(candidate.latestSlideId || fallbackSlideId).trim();
  return {
    initialSlideId: initialSlideId || fallbackSlideId,
    latestSlideId: latestSlideId || fallbackSlideId,
    hasMultipleSlides:
      candidate.hasMultipleSlides === true || (Array.isArray(slides) && slides.length > 1),
    slides: normalizedSlides,
  };
};

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
    inProgressItems: Array.isArray(candidate.inProgressItems) ? candidate.inProgressItems : [],
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
    homeHero: normalizePublicBootstrapHomeHero(candidate.homeHero),
    currentPostDetail: normalizePublicBootstrapPostDetail(candidate.currentPostDetail),
    generatedAt: String(candidate.generatedAt || ""),
    payloadMode: normalizePublicBootstrapPayloadMode(candidate.payloadMode),
  };
};

export const asPublicBootstrapCurrentUser = (value: unknown): PublicBootstrapCurrentUser | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<PublicBootstrapCurrentUser>;
  const id = String(candidate.id || "").trim();
  if (!id) {
    return null;
  }
  const permissions = Array.isArray(candidate.permissions)
    ? candidate.permissions.map((permission) => String(permission || "").trim()).filter(Boolean)
    : [];
  const ownerIds = Array.isArray(candidate.ownerIds)
    ? candidate.ownerIds.map((ownerId) => String(ownerId || "").trim()).filter(Boolean)
    : [];
  return {
    id,
    name: String(candidate.name || ""),
    username: String(candidate.username || ""),
    email: candidate.email ? String(candidate.email) : null,
    avatarUrl: candidate.avatarUrl ? String(candidate.avatarUrl) : null,
    revision: candidate.revision ? String(candidate.revision) : null,
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
