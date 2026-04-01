import type { ContentVersion } from "@/types/editorial";

import { normalizeComparableDashboardPostCoverUrl } from "@/lib/dashboard-post-editor";

export const emptyPostForm = {
  title: "",
  slug: "",
  excerpt: "",
  contentLexical: "",
  author: "",
  coverImageUrl: "",
  coverAlt: "",
  status: "draft" as "draft" | "scheduled" | "published",
  publishAt: "",
  projectId: "",
  tags: [] as string[],
};

export type PostRecord = {
  id: string;
  title: string;
  slug: string;
  coverImageUrl?: string | null;
  coverAlt?: string | null;
  excerpt: string;
  content: string;
  contentFormat?: "lexical";
  author: string;
  publishedAt: string;
  scheduledAt?: string | null;
  status: "draft" | "scheduled" | "published";
  seoTitle?: string | null;
  seoDescription?: string | null;
  projectId?: string | null;
  tags?: string[];
  views: number;
  commentsCount: number;
  deletedAt?: string | null;
  deletedBy?: string | null;
};

export type UserRecord = {
  id: string;
  permissions: string[];
};

export const getPostStatusLabel = (status: PostRecord["status"]): string => {
  if (status === "published") {
    return "Publicado";
  }
  if (status === "scheduled") {
    return "Agendado";
  }
  return "Rascunho";
};

type ComparablePostSnapshot = {
  title: string;
  slug: string;
  status: PostRecord["status"];
  publishedAt: string;
  scheduledAt: string | null;
  projectId: string;
  excerpt: string;
  content: string;
  contentFormat: string;
  author: string;
  coverImageUrl: string;
  coverAlt: string;
  seoTitle: string;
  seoDescription: string;
  tags: string[];
};

const normalizeComparableTags = (value?: string[] | null) =>
  (Array.isArray(value) ? value : []).map((tag) => String(tag || "").trim()).filter(Boolean);

const buildComparableSnapshotFromPost = (
  post?: PostRecord | null,
): ComparablePostSnapshot | null => {
  if (!post) {
    return null;
  }
  return {
    title: String(post.title || "").trim(),
    slug: String(post.slug || "").trim(),
    status: post.status === "scheduled" || post.status === "published" ? post.status : "draft",
    publishedAt: String(post.publishedAt || "").trim(),
    scheduledAt: post.scheduledAt ? String(post.scheduledAt).trim() || null : null,
    projectId: String(post.projectId || "").trim(),
    excerpt: String(post.excerpt || ""),
    content: String(post.content || ""),
    contentFormat: String(post.contentFormat || "lexical"),
    author: String(post.author || "").trim(),
    coverImageUrl: normalizeComparableDashboardPostCoverUrl(post.coverImageUrl),
    coverAlt: String(post.coverAlt || ""),
    seoTitle: String(post.seoTitle || ""),
    seoDescription: String(post.seoDescription || ""),
    tags: normalizeComparableTags(post.tags),
  };
};

const normalizeComparableVersionSnapshot = (
  snapshot?: ContentVersion["snapshot"] | null,
): ComparablePostSnapshot => ({
  title: String(snapshot?.title || "").trim(),
  slug: String(snapshot?.slug || "").trim(),
  status:
    snapshot?.status === "scheduled" || snapshot?.status === "published"
      ? snapshot.status
      : "draft",
  publishedAt: String(snapshot?.publishedAt || "").trim(),
  scheduledAt: snapshot?.scheduledAt ? String(snapshot.scheduledAt).trim() || null : null,
  projectId: String(snapshot?.projectId || "").trim(),
  excerpt: String(snapshot?.excerpt || ""),
  content: String(snapshot?.content || ""),
  contentFormat: String(snapshot?.contentFormat || "lexical"),
  author: String(snapshot?.author || "").trim(),
  coverImageUrl: normalizeComparableDashboardPostCoverUrl(snapshot?.coverImageUrl),
  coverAlt: String(snapshot?.coverAlt || ""),
  seoTitle: String(snapshot?.seoTitle || ""),
  seoDescription: String(snapshot?.seoDescription || ""),
  tags: normalizeComparableTags(snapshot?.tags),
});

export const isVersionRestorableAgainstPost = (
  version: ContentVersion,
  post?: PostRecord | null,
) => {
  const current = buildComparableSnapshotFromPost(post);
  if (!current) {
    return false;
  }
  const candidate = normalizeComparableVersionSnapshot(version?.snapshot);
  if (JSON.stringify(candidate) !== JSON.stringify(current)) {
    return true;
  }

  const topLevelVersionSlug = String(version?.slug || "").trim();
  if (topLevelVersionSlug && topLevelVersionSlug !== current.slug) {
    return true;
  }
  const snapshotTitle = String(version?.snapshot?.title || "").trim();
  if (snapshotTitle && snapshotTitle !== current.title) {
    return true;
  }
  return false;
};

export const hasRestorableVersionForPost = (
  versions: ContentVersion[],
  post?: PostRecord | null,
  nextCursor?: string | null,
) => {
  if (
    (Array.isArray(versions) ? versions : []).some((version) =>
      isVersionRestorableAgainstPost(version, post),
    )
  ) {
    return true;
  }
  return Boolean(nextCursor);
};
