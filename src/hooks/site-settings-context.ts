import { createContext } from "react";
import type { SiteSettings } from "@/types/site-settings";

export const defaultSettings: SiteSettings = {
  site: {
    name: "NEKOMATA",
    logoUrl: "",
    faviconUrl: "",
    description:
      "Fansub dedicada a trazer histórias inesquecíveis com o carinho que a comunidade merece.",
    defaultShareImage: "/placeholder.svg",
  },
  navbar: {
    recruitmentUrl: "https://discord.com/invite/BAHKhdX2ju",
  },
  community: {
    discordUrl: "https://discord.com/invite/BAHKhdX2ju",
  },
  downloads: {
    sources: [
      { id: "google-drive", label: "Google Drive", color: "#34A853", icon: "google-drive" },
      { id: "mega", label: "MEGA", color: "#D9272E", icon: "mega" },
      { id: "torrent", label: "Torrent", color: "#7C3AED", icon: "torrent" },
      { id: "mediafire", label: "Mediafire", color: "#2563EB", icon: "mediafire" },
      { id: "telegram", label: "Telegram", color: "#0EA5E9", icon: "telegram" },
      { id: "outro", label: "Outro", color: "#64748B", icon: "link" },
    ],
  },
  teamRoles: [
    { id: "tradutor", label: "Tradutor", icon: "languages" },
    { id: "revisor", label: "Revisor", icon: "check" },
    { id: "typesetter", label: "Typesetter", icon: "pen-tool" },
    { id: "qualidade", label: "Qualidade", icon: "sparkles" },
    { id: "desenvolvedor", label: "Desenvolvedor", icon: "code" },
    { id: "cleaner", label: "Cleaner", icon: "paintbrush" },
    { id: "redrawer", label: "Redrawer", icon: "layers" },
    { id: "encoder", label: "Encoder", icon: "video" },
    { id: "k-timer", label: "K-Timer", icon: "clock" },
    { id: "logo-maker", label: "Logo Maker", icon: "badge" },
    { id: "k-maker", label: "K-Maker", icon: "palette" },
  ],
  footer: {
    brandName: "NEKOMATA",
    brandLogoUrl: "",
    brandDescription:
      "Fansub dedicada a trazer histórias inesquecíveis com o carinho que a comunidade merece. Traduzimos por paixão, respeitando autores e apoiando o consumo legal das obras.",
    columns: [
      {
        title: "Nekomata",
        links: [
          { label: "Sobre", href: "/sobre" },
          { label: "Equipe", href: "/equipe" },
        ],
      },
      {
        title: "Ajude nossa equipe",
        links: [
          { label: "Recrutamento", href: "https://discord.com/invite/BAHKhdX2ju" },
          { label: "Doações", href: "/doacoes" },
        ],
      },
      {
        title: "Links úteis",
        links: [
          { label: "Projetos", href: "/projetos" },
          { label: "FAQ", href: "/faq" },
          { label: "Reportar erros", href: "https://discord.com/invite/BAHKhdX2ju" },
          { label: "Info Anime", href: "https://infoanime.com.br" },
        ],
      },
    ],
    socialLinks: [
      { label: "Instagram", href: "https://instagram.com", icon: "instagram" },
      { label: "Facebook", href: "https://facebook.com", icon: "facebook" },
      { label: "Twitter", href: "https://twitter.com", icon: "twitter" },
      { label: "Discord", href: "https://discord.com/invite/BAHKhdX2ju", icon: "discord" },
    ],
    disclaimer: [
      "Todo o conteúdo divulgado aqui pertence a seus respectivos autores e editoras. As traduções são realizadas por fãs, sem fins lucrativos, com o objetivo de divulgar as obras no Brasil.",
      "Caso goste de alguma obra, apoie a versão oficial. A venda de materiais legendados pela equipe é proibida.",
    ],
    highlightTitle: "Atribuição • Não Comercial",
    highlightDescription:
      "Este site segue a licença Creative Commons BY-NC. Você pode compartilhar com créditos, sem fins comerciais.",
    copyright: "© 2014 - 2026 Nekomata Fansub. Feito por fãs para fãs.",
  },
};

export const mergeSettings = <T,>(base: T, override: Partial<T> | undefined): T => {
  if (Array.isArray(base)) {
    return (Array.isArray(override) ? override : base) as T;
  }
  if (base && typeof base === "object") {
    const next = { ...(base as Record<string, unknown>) };
    if (override && typeof override === "object") {
      Object.keys(override as Record<string, unknown>).forEach((key) => {
        next[key] = mergeSettings(
          (base as Record<string, unknown>)[key],
          (override as Record<string, unknown>)[key],
        );
      });
    }
    return next as T;
  }
  return ((override as T) ?? base) as T;
};

export type SiteSettingsContextValue = {
  settings: SiteSettings;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

export const SiteSettingsContext = createContext<SiteSettingsContextValue>({
  settings: defaultSettings,
  isLoading: true,
  refresh: async () => undefined,
});
