import type { PublicBootstrapPostDetail } from "@/types/public-bootstrap";

const preloadedPublicPostDetails = new Map<string, PublicBootstrapPostDetail>();

const normalizePostSlug = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase();

export const storePreloadedPublicPostDetail = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<PublicBootstrapPostDetail>;
  const slug = normalizePostSlug(candidate.slug);
  if (!slug) {
    return null;
  }
  const nextValue = candidate as PublicBootstrapPostDetail;
  preloadedPublicPostDetails.set(slug, nextValue);
  return nextValue;
};

export const peekPreloadedPublicPostDetail = (slug: string | undefined) => {
  const normalizedSlug = normalizePostSlug(slug);
  if (!normalizedSlug) {
    return null;
  }
  return preloadedPublicPostDetails.get(normalizedSlug) || null;
};

export const clearPreloadedPublicPostDetailsForTests = () => {
  preloadedPublicPostDetails.clear();
};
