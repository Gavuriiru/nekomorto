import { emptyPublicPagesConfig, type PublicPagesConfig } from "@/types/public-pages";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export const mergePublicPageConfig = <T extends Record<string, unknown>>(
  fallback: T,
  value: unknown,
): T => {
  if (!isRecord(value)) {
    return fallback;
  }
  return {
    ...fallback,
    ...value,
  } as T;
};

export const normalizePublicPagesConfig = (value: unknown): PublicPagesConfig => {
  const source = isRecord(value) ? value : {};
  return {
    home: mergePublicPageConfig(emptyPublicPagesConfig.home, source.home),
    projects: mergePublicPageConfig(emptyPublicPagesConfig.projects, source.projects),
    about: mergePublicPageConfig(emptyPublicPagesConfig.about, source.about),
    donations: mergePublicPageConfig(emptyPublicPagesConfig.donations, source.donations),
    faq: mergePublicPageConfig(emptyPublicPagesConfig.faq, source.faq),
    team: mergePublicPageConfig(emptyPublicPagesConfig.team, source.team),
    recruitment: mergePublicPageConfig(emptyPublicPagesConfig.recruitment, source.recruitment),
  };
};
