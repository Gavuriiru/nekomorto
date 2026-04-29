export type PublicShareImagePage = {
  shareImage: string;
  shareImageAlt: string;
};

export type AboutPageHighlight = {
  label: string;
  text: string;
  icon?: string;
};

export type AboutPageValue = {
  title: string;
  description: string;
  icon?: string;
};

export type AboutPagePillar = {
  title: string;
  description: string;
  icon?: string;
};

export type DonationsPageCost = {
  title: string;
  description: string;
  icon?: string;
};

export type DonationsPageDonor = {
  name: string;
  amount: string;
  goal: string;
  date: string;
};

export type DonationsCryptoService = {
  name: string;
  ticker: string;
  network: string;
  address: string;
  qrValue: string;
  note: string;
  icon: string;
  actionLabel: string;
  actionUrl: string;
};

export type FaqPageItem = {
  question: string;
  answer: string;
};

export type FaqPageGroup = {
  title: string;
  icon?: string;
  items: FaqPageItem[];
};

export type FaqPageIntroCard = {
  title: string;
  icon?: string;
  text: string;
  note: string;
};

export type RecruitmentPageRole = {
  title: string;
  description: string;
  icon?: string;
};

export type AboutPageConfig = PublicShareImagePage & {
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  heroBadges: string[];
  highlights: AboutPageHighlight[];
  manifestoTitle: string;
  manifestoIcon: string;
  manifestoParagraphs: string[];
  pillars: AboutPagePillar[];
  values: AboutPageValue[];
};

export type DonationsPageConfig = PublicShareImagePage & {
  heroTitle: string;
  heroSubtitle: string;
  costs: DonationsPageCost[];
  reasonTitle: string;
  reasonIcon: string;
  reasonText: string;
  reasonNote: string;
  monthlyGoalRaised: string;
  monthlyGoalTarget: string;
  monthlyGoalSupporters: string;
  monthlyGoalNote: string;
  cryptoTitle: string;
  cryptoSubtitle: string;
  cryptoServices: DonationsCryptoService[];
  pixKey: string;
  pixNote: string;
  pixCity: string;
  qrCustomUrl: string;
  pixIcon: string;
  donorsIcon: string;
  donors: DonationsPageDonor[];
};

export type FaqPageConfig = PublicShareImagePage & {
  heroTitle: string;
  heroSubtitle: string;
  introCards: FaqPageIntroCard[];
  groups: FaqPageGroup[];
};

export type TeamPageConfig = PublicShareImagePage & {
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  retiredTitle: string;
  retiredSubtitle: string;
};

export type RecruitmentPageConfig = PublicShareImagePage & {
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  roles: RecruitmentPageRole[];
  ctaTitle: string;
  ctaSubtitle: string;
  ctaButtonLabel: string;
};

export type PublicPagesConfig = {
  home: PublicShareImagePage;
  projects: PublicShareImagePage;
  about: AboutPageConfig;
  donations: DonationsPageConfig;
  faq: FaqPageConfig;
  team: TeamPageConfig;
  recruitment: RecruitmentPageConfig;
};

export const emptyPublicPagesConfig: PublicPagesConfig = {
  home: {
    shareImage: "",
    shareImageAlt: "",
  },
  projects: {
    shareImage: "",
    shareImageAlt: "",
  },
  about: {
    shareImage: "",
    shareImageAlt: "",
    heroBadge: "",
    heroTitle: "",
    heroSubtitle: "",
    heroBadges: [],
    highlights: [],
    manifestoTitle: "",
    manifestoIcon: "",
    manifestoParagraphs: [],
    pillars: [],
    values: [],
  },
  donations: {
    shareImage: "",
    shareImageAlt: "",
    heroTitle: "",
    heroSubtitle: "",
    costs: [],
    reasonTitle: "",
    reasonIcon: "",
    reasonText: "",
    reasonNote: "",
    monthlyGoalRaised: "",
    monthlyGoalTarget: "",
    monthlyGoalSupporters: "",
    monthlyGoalNote: "",
    cryptoTitle: "",
    cryptoSubtitle: "",
    cryptoServices: [],
    pixKey: "",
    pixNote: "",
    pixCity: "",
    qrCustomUrl: "",
    pixIcon: "",
    donorsIcon: "",
    donors: [],
  },
  faq: {
    shareImage: "",
    shareImageAlt: "",
    heroTitle: "",
    heroSubtitle: "",
    introCards: [],
    groups: [],
  },
  team: {
    shareImage: "",
    shareImageAlt: "",
    heroBadge: "",
    heroTitle: "",
    heroSubtitle: "",
    retiredTitle: "",
    retiredSubtitle: "",
  },
  recruitment: {
    shareImage: "",
    shareImageAlt: "",
    heroBadge: "",
    heroTitle: "",
    heroSubtitle: "",
    roles: [],
    ctaTitle: "",
    ctaSubtitle: "",
    ctaButtonLabel: "",
  },
};
