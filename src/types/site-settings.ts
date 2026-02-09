export type SiteSettings = {
  site: {
    name: string;
    logoUrl: string;
    faviconUrl: string;
    description: string;
    defaultShareImage: string;
    titleSeparator?: string;
  };
  theme: {
    accent: string;
  };
  navbar: {
    links: Array<{
      label: string;
      href: string;
      icon?: string;
    }>;
  };
  community: {
    discordUrl: string;
  };
  branding: {
    assets: {
      symbolUrl: string;
      wordmarkUrl: string;
    };
    overrides: {
      navbarSymbolUrl: string;
      footerSymbolUrl: string;
      navbarWordmarkUrl: string;
      footerWordmarkUrl: string;
    };
    display: {
      navbar: "wordmark" | "symbol-text" | "symbol" | "text";
      footer: "wordmark" | "symbol-text" | "text";
    };
    wordmarkUrl: string;
    wordmarkUrlNavbar: string;
    wordmarkUrlFooter: string;
    wordmarkPlacement: "navbar" | "footer" | "both";
    wordmarkEnabled: boolean;
  };
  downloads: {
    sources: Array<{
      id: string;
      label: string;
      color: string;
      icon?: string;
      tintIcon?: boolean;
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
