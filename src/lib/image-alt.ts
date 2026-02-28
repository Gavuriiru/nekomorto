export type ShareImageAltPageKey =
  | "home"
  | "projects"
  | "about"
  | "donations"
  | "faq"
  | "team"
  | "recruitment";

export const DEFAULT_POST_COVER_ALT = "Capa da postagem";
export const DEFAULT_PROJECT_COVER_ALT = "Capa do projeto";
export const DEFAULT_PROJECT_BANNER_ALT = "Banner do projeto";
export const DEFAULT_PROJECT_HERO_ALT = "Imagem de destaque do projeto";
export const DEFAULT_EPISODE_COVER_ALT = "Capa do episódio";
export const DEFAULT_CHAPTER_COVER_ALT = "Capa do capítulo";
export const DEFAULT_SITE_SHARE_IMAGE_ALT = "Imagem padrão de compartilhamento";

const SHARE_IMAGE_ALT_FALLBACKS: Record<ShareImageAltPageKey, string> = {
  home: "Imagem de compartilhamento da página inicial",
  projects: "Imagem de compartilhamento da página de projetos",
  about: "Imagem de compartilhamento da página sobre",
  donations: "Imagem de compartilhamento da página de doações",
  faq: "Imagem de compartilhamento da página FAQ",
  team: "Imagem de compartilhamento da página equipe",
  recruitment: "Imagem de compartilhamento da página de recrutamento",
};

export const getShareImageAltFallback = (pageKey: ShareImageAltPageKey) =>
  SHARE_IMAGE_ALT_FALLBACKS[pageKey];

export const getEpisodeCoverAltFallback = (isChapterBased: boolean) =>
  isChapterBased ? DEFAULT_CHAPTER_COVER_ALT : DEFAULT_EPISODE_COVER_ALT;

export const resolveAssetAltText = (
  rawAltText: string | null | undefined,
  fallback: string,
) => {
  const trimmed = String(rawAltText || "").trim();
  return trimmed || fallback;
};
