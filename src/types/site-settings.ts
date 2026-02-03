export type SiteSettings = {
  site: {
    name: string;
    logoUrl: string;
    faviconUrl: string;
    description: string;
    defaultShareImage: string;
  };
  navbar: {
    recruitmentUrl: string;
  };
  community: {
    discordUrl: string;
  };
  downloads: {
    sources: Array<{
      id: string;
      label: string;
      color: string;
      icon?: string;
    }>;
  };
  teamRoles: Array<{
    id: string;
    label: string;
    icon?: string;
  }>;
  footer: {
    brandName: string;
    brandLogoUrl: string;
    brandDescription: string;
    columns: Array<{
      title: string;
      links: Array<{ label: string; href: string }>;
    }>;
    socialLinks: Array<{ label: string; href: string; icon?: string }>;
    disclaimer: string[];
    highlightTitle: string;
    highlightDescription: string;
    copyright: string;
  };
};
