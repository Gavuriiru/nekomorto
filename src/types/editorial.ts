export type ContentVersionReason = "create" | "update" | "manual" | "rollback";

export type ContentVersionSnapshot = {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "scheduled" | "published";
  publishedAt: string;
  scheduledAt?: string | null;
  projectId?: string;
  excerpt?: string;
  content?: string;
  contentFormat?: string;
  author?: string;
  coverImageUrl?: string | null;
  coverAlt?: string;
  seoTitle?: string;
  seoDescription?: string;
  tags?: string[];
  updatedAt?: string;
};

export type ContentVersion = {
  id: string;
  postId: string;
  versionNumber: number;
  reason: ContentVersionReason;
  reasonLabel?: string;
  label?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  slug: string;
  createdAt: string;
  snapshot: ContentVersionSnapshot;
};

export type ContentVersionListResponse = {
  postId: string;
  versions: ContentVersion[];
  nextCursor?: string | null;
};

export type RollbackResult = {
  targetVersionId: string;
  backupVersionId?: string | null;
  rollbackVersionId?: string | null;
  slugAdjusted?: boolean;
  targetSlug?: string;
  resultingSlug?: string;
};

export type EditorialCalendarItem = {
  id: string;
  title: string;
  slug: string;
  status: "scheduled" | "published";
  projectId?: string;
  publishedAt: string;
  scheduledAt?: string | null;
};

export type EditorialCalendarResponse = {
  from: string;
  to: string;
  tz: string;
  items: EditorialCalendarItem[];
};
