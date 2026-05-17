import { describe, expect, it } from "vitest";

import {
  ABOUT_PAGE_DEFAULTS,
  FAQ_PAGE_DEFAULTS,
  RECRUITMENT_PAGE_DEFAULTS,
  normalizeAboutPublicPage,
  normalizeFaqPublicPage,
  normalizeRecruitmentPublicPage,
} from "../../shared/public-page-content.js";

describe("public-page-content normalization", () => {
  it("keeps the about fallback content when the cms payload is blank", () => {
    expect(
      normalizeAboutPublicPage({
        heroTitle: " ",
        heroSubtitle: "",
        heroBadges: [],
        highlights: [],
        manifestoParagraphs: [],
        pillars: [],
        values: [],
      }),
    ).toMatchObject({
      heroTitle: ABOUT_PAGE_DEFAULTS.heroTitle,
      heroSubtitle: ABOUT_PAGE_DEFAULTS.heroSubtitle,
      highlights: ABOUT_PAGE_DEFAULTS.highlights,
    });
  });

  it("keeps the faq fallback content when groups are blank", () => {
    expect(
      normalizeFaqPublicPage({
        heroTitle: "",
        heroSubtitle: "",
        introCards: [],
        groups: [],
      }),
    ).toMatchObject({
      heroTitle: FAQ_PAGE_DEFAULTS.heroTitle,
      heroSubtitle: FAQ_PAGE_DEFAULTS.heroSubtitle,
      groups: FAQ_PAGE_DEFAULTS.groups,
    });
  });

  it("keeps the recruitment fallback content when roles are blank", () => {
    expect(
      normalizeRecruitmentPublicPage({
        heroTitle: "",
        heroSubtitle: "",
        roles: [],
        ctaTitle: "",
        ctaSubtitle: "",
        ctaButtonLabel: "",
      }),
    ).toMatchObject({
      heroTitle: RECRUITMENT_PAGE_DEFAULTS.heroTitle,
      heroSubtitle: RECRUITMENT_PAGE_DEFAULTS.heroSubtitle,
      roles: RECRUITMENT_PAGE_DEFAULTS.roles,
    });
  });
});
