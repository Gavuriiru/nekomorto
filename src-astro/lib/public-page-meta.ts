import {
  buildInstitutionalOgImageAlt,
  buildInstitutionalOgRevision,
  buildVersionedInstitutionalOgImagePath,
  resolveInstitutionalOgPageTitle,
  resolveInstitutionalOgSupportText,
} from "../../shared/institutional-og-seo.js";

interface InstitutionalPageMetaInput {
  pageKey: string;
  pages?: unknown;
  siteSettings?: unknown;
}

export const buildInstitutionalPageMeta = ({
  pageKey,
  pages,
  siteSettings,
}: InstitutionalPageMetaInput) => ({
  description: resolveInstitutionalOgSupportText({
    pageKey,
    pages,
    settings: siteSettings,
  }),
  image: buildVersionedInstitutionalOgImagePath({
    pageKey,
    revision: buildInstitutionalOgRevision({
      pageKey,
      pages,
      settings: siteSettings,
    } as any),
  }),
  imageAlt: buildInstitutionalOgImageAlt(pageKey),
  title: resolveInstitutionalOgPageTitle(pageKey),
});
