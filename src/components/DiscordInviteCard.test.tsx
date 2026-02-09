import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DiscordInviteCard from "@/components/DiscordInviteCard";
import { defaultSettings, mergeSettings } from "@/hooks/site-settings-context";
import type { SiteSettings } from "@/types/site-settings";

const useSiteSettingsMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => useSiteSettingsMock(),
}));

const createSettings = (override: unknown) =>
  mergeSettings(defaultSettings, override as Partial<SiteSettings>);

const mockSiteSettings = (override: unknown) => {
  const settings = createSettings(override);
  useSiteSettingsMock.mockReturnValue({
    settings,
    isLoading: false,
    refresh: vi.fn(async () => undefined),
  });
  return settings;
};

describe("DiscordInviteCard", () => {
  beforeEach(() => {
    useSiteSettingsMock.mockReset();
  });

  it("renderiza os textos configurados", () => {
    mockSiteSettings({
      community: {
        discordUrl: "https://discord.com/invite/base",
        inviteCard: {
          title: "Entre na comunidade",
          subtitle: "Fale com a equipe em tempo real.",
          panelTitle: "Servidor oficial",
          panelDescription: "Atualizacoes, avisos e bate-papo com os membros.",
          ctaLabel: "Entrar agora",
          ctaUrl: "https://discord.gg/nekomata",
        },
      },
    });

    render(<DiscordInviteCard />);

    expect(screen.getByText("Entre na comunidade")).toBeInTheDocument();
    expect(screen.getByText("Fale com a equipe em tempo real.")).toBeInTheDocument();
    expect(screen.getByText("Servidor oficial")).toBeInTheDocument();
    expect(screen.getByText("Atualizacoes, avisos e bate-papo com os membros.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar agora" })).toBeInTheDocument();
  });

  it("usa a ctaUrl configurada quando preenchida", () => {
    mockSiteSettings({
      community: {
        discordUrl: "https://discord.com/invite/fallback",
        inviteCard: {
          title: "Entre no Discord",
          subtitle: "Converse com a equipe.",
          panelTitle: "Comunidade",
          panelDescription: "Acompanhe novidades.",
          ctaLabel: "Abrir Discord",
          ctaUrl: "https://discord.gg/url-propria",
        },
      },
    });

    render(<DiscordInviteCard />);

    expect(screen.getByRole("link", { name: "Abrir Discord" })).toHaveAttribute(
      "href",
      "https://discord.gg/url-propria",
    );
  });

  it("faz fallback para community.discordUrl quando ctaUrl estiver vazia", () => {
    mockSiteSettings({
      community: {
        discordUrl: "https://discord.com/invite/fallback-card",
        inviteCard: {
          title: "Entre no Discord",
          subtitle: "Converse com a equipe.",
          panelTitle: "Comunidade",
          panelDescription: "Acompanhe novidades.",
          ctaLabel: "Entrar no servidor",
          ctaUrl: "",
        },
      },
    });

    render(<DiscordInviteCard />);

    expect(screen.getByRole("link", { name: "Entrar no servidor" })).toHaveAttribute(
      "href",
      "https://discord.com/invite/fallback-card",
    );
  });

  it("nao exibe redes sociais do footer", () => {
    mockSiteSettings({
      community: {
        discordUrl: "https://discord.com/invite/fallback",
        inviteCard: {
          title: "Entre no Discord",
          subtitle: "Converse com a equipe.",
          panelTitle: "Comunidade",
          panelDescription: "Acompanhe novidades.",
          ctaLabel: "Entrar",
          ctaUrl: "https://discord.gg/cta",
        },
      },
      footer: {
        socialLinks: [
          { label: "Instagram", href: "https://instagram.com/nekomata", icon: "instagram" },
          { label: "Facebook", href: "https://facebook.com/nekomata", icon: "facebook" },
          { label: "Twitter", href: "https://twitter.com/nekomata", icon: "twitter" },
          { label: "YouTube", href: "https://youtube.com/nekomata", icon: "youtube" },
          { label: "Discord", href: "https://discord.gg/nekomata", icon: "discord" },
        ],
      },
    });

    render(<DiscordInviteCard />);

    expect(screen.queryByRole("link", { name: "Instagram" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Facebook" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Twitter" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "YouTube" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Discord" })).not.toBeInTheDocument();
  });
});
