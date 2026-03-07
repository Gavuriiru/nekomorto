export type FavoriteWorkCategory = "manga" | "anime";

export type FavoriteWorksByCategory = Record<FavoriteWorkCategory, string[]>;

export type PublicTeamSocialLink = {
  label: string;
  href: string;
};

export type PublicTeamLinkType = {
  id: string;
  label: string;
  icon: string;
};

export type PublicTeamMember = {
  id: string;
  name: string;
  phrase: string;
  bio: string;
  avatarUrl?: string | null;
  socials?: PublicTeamSocialLink[];
  favoriteWorks?: FavoriteWorksByCategory;
  permissions?: string[];
  roles?: string[];
  isAdmin?: boolean;
  status?: "active" | "retired" | string;
  order?: number;
  avatarDisplay?: string;
  accessRole?: string;
};
