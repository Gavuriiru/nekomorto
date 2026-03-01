import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Team from "@/pages/Team";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({
    settings: {
      teamRoles: [],
    },
  }),
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const activeMemberName = "Jose Gabriel Nome Muito Muito Muito Grande Para Mobile";
const retiredMemberName = "Membro Aposentado Com Nome Bastante Longo";

const usersFixture = [
  {
    id: "member-active",
    name: activeMemberName,
    avatarUrl: "/uploads/users/active-avatar.png",
    phrase: "Frase ativa",
    bio: "Bio ativa",
    status: "active",
    roles: ["Membro"],
    socials: [
      { label: "instagram", href: "https://instagram.com/active" },
      { label: "youtube", href: "https://youtube.com/active" },
      { label: "twitter", href: "https://twitter.com/active" },
      { label: "site", href: "https://active.dev" },
    ],
  },
  {
    id: "member-retired",
    name: retiredMemberName,
    avatarUrl: "/uploads/users/retired-avatar.png",
    phrase: "Frase aposentado",
    bio: "Bio aposentado",
    status: "retired",
    roles: ["Membro"],
    socials: [
      { label: "instagram", href: "https://instagram.com/retired" },
      { label: "youtube", href: "https://youtube.com/retired" },
      { label: "twitter", href: "https://twitter.com/retired" },
      { label: "site", href: "https://retired.dev" },
    ],
  },
];

const usersMediaVariantsFixture = {
  "/uploads/users/active-avatar.png": {
    variantsVersion: 2,
    variants: {
      square: {
        formats: {
          avif: { url: "/uploads/_variants/u-active/square-v2.avif" },
          webp: { url: "/uploads/_variants/u-active/square-v2.webp" },
          fallback: { url: "/uploads/_variants/u-active/square-v2.png" },
        },
      },
    },
  },
  "/uploads/users/retired-avatar.png": {
    variantsVersion: 2,
    variants: {
      square: {
        formats: {
          avif: { url: "/uploads/_variants/u-retired/square-v2.avif" },
          webp: { url: "/uploads/_variants/u-retired/square-v2.webp" },
          fallback: { url: "/uploads/_variants/u-retired/square-v2.png" },
        },
      },
    },
  },
};

const linkTypesFixture = [
  { id: "instagram", label: "Instagram", icon: "instagram" },
  { id: "youtube", label: "YouTube", icon: "youtube" },
  { id: "twitter", label: "Twitter", icon: "twitter" },
  { id: "site", label: "Site", icon: "globe" },
];

const classTokens = (element: HTMLElement) => String(element.className).split(/\s+/).filter(Boolean);

const getMemberLayoutByName = (memberName: string) => {
  const heading = screen.getByRole("heading", { name: memberName });
  const contentPanel = heading.closest("div.rounded-2xl");
  expect(contentPanel).not.toBeNull();

  const layoutStack = contentPanel?.parentElement as HTMLElement | null;
  expect(layoutStack).not.toBeNull();

  const avatarImage = screen.getByRole("img", { name: memberName });
  const avatarPicture = avatarImage.parentElement as HTMLElement | null;
  expect(avatarPicture).not.toBeNull();

  const avatarStage = avatarPicture?.parentElement as HTMLElement | null;
  expect(avatarStage).not.toBeNull();

  const avatarSlot = avatarStage?.parentElement as HTMLElement | null;
  expect(avatarSlot).not.toBeNull();

  const card = layoutStack?.parentElement?.parentElement as HTMLElement | null;
  expect(card).not.toBeNull();

  const links = within(contentPanel as HTMLElement).getAllByRole("link");
  expect(links.length).toBeGreaterThan(0);

  const socialContainer = links[0]?.parentElement as HTMLElement | null;
  expect(socialContainer).not.toBeNull();

  return {
    avatarImage,
    heading,
    headingRow: heading.parentElement as HTMLElement,
    layoutStack: layoutStack as HTMLElement,
    avatarSlot: avatarSlot as HTMLElement,
    avatarStage: avatarStage as HTMLElement,
    contentPanel: contentPanel as HTMLElement,
    card: card as HTMLElement,
    socialContainer: socialContainer as HTMLElement,
  };
};

const assertResponsiveSideLayout = (
  layoutStack: HTMLElement,
  avatarSlot: HTMLElement,
  avatarStage: HTMLElement,
  contentPanel: HTMLElement,
) => {
  const layoutTokens = classTokens(layoutStack);
  expect(layoutTokens).toContain("flex");
  expect(layoutTokens).toContain("flex-col");
  expect(layoutTokens).toContain("gap-5");
  expect(layoutTokens).toContain("lg:grid");
  expect(layoutTokens).toContain("lg:grid-cols-[260px_minmax(0,1fr)]");
  expect(layoutTokens).toContain("lg:items-stretch");

  const avatarSlotTokens = classTokens(avatarSlot);
  expect(avatarSlotTokens).toContain("flex");
  expect(avatarSlotTokens).toContain("items-center");
  expect(avatarSlotTokens).toContain("justify-center");
  expect(avatarSlotTokens).toContain("min-h-64");
  expect(avatarSlotTokens).toContain("sm:min-h-72");
  expect(avatarSlotTokens).toContain("lg:min-h-[280px]");
  expect(avatarSlotTokens).not.toContain("rounded-3xl");
  expect(avatarSlotTokens).not.toContain("overflow-hidden");

  const avatarStageTokens = classTokens(avatarStage);
  expect(avatarStageTokens).toContain("relative");
  expect(avatarStageTokens).toContain("h-56");
  expect(avatarStageTokens).toContain("w-56");
  expect(avatarStageTokens).toContain("sm:h-60");
  expect(avatarStageTokens).toContain("md:h-64");
  expect(avatarStageTokens).toContain("lg:h-64");
  expect(avatarStageTokens).toContain("z-10");
  expect(avatarStageTokens).toContain("rounded-full");
  expect(avatarStageTokens).not.toContain("h-full");
  expect(avatarStageTokens).not.toContain("w-full");
  expect(avatarStageTokens).not.toContain("absolute");

  expect(layoutStack.firstElementChild).toBe(avatarSlot);
  expect(avatarSlot.compareDocumentPosition(contentPanel) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
};

const assertSocialFlow = (socialContainer: HTMLElement) => {
  const socialTokens = classTokens(socialContainer);
  expect(socialTokens).not.toContain("absolute");
  expect(socialTokens).not.toContain("lg:absolute");
  expect(socialTokens).toContain("flex-wrap");
  expect(socialTokens).toContain("gap-2");
};

const setupApiMock = (users = usersFixture) => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();

    if (endpoint === "/api/public/users" && method === "GET") {
      return mockJsonResponse(true, {
        users,
        mediaVariants: usersMediaVariantsFixture,
      });
    }
    if (endpoint === "/api/link-types" && method === "GET") {
      return mockJsonResponse(true, { items: linkTypesFixture });
    }
    if (endpoint === "/api/public/pages" && method === "GET") {
      return mockJsonResponse(true, { pages: { team: {} } });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

describe("Team mobile social layout", () => {
  beforeEach(() => {
    setupApiMock();
  });

  it("mantem nome no fluxo e redes com classe responsiva no card ativo", async () => {
    render(
      <MemoryRouter>
        <Team />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: activeMemberName });
    const { heading, headingRow, layoutStack, avatarSlot, avatarStage, contentPanel, card, socialContainer } =
      getMemberLayoutByName(activeMemberName);

    assertResponsiveSideLayout(layoutStack, avatarSlot, avatarStage, contentPanel);

    expect(classTokens(heading)).toContain("break-words");
    expect(classTokens(headingRow)).toContain("min-w-0");
    expect(classTokens(headingRow)).toContain("space-y-3");
    expect(classTokens(card)).not.toContain("mt-20");

    assertSocialFlow(socialContainer);

    expect(heading.compareDocumentPosition(socialContainer) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it("aplica a mesma regra responsiva para redes no card aposentado", async () => {
    render(
      <MemoryRouter>
        <Team />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: retiredMemberName });
    const { heading, headingRow, layoutStack, avatarSlot, avatarStage, contentPanel, card, socialContainer } =
      getMemberLayoutByName(retiredMemberName);

    assertResponsiveSideLayout(layoutStack, avatarSlot, avatarStage, contentPanel);

    expect(classTokens(heading)).toContain("break-words");
    expect(classTokens(headingRow)).toContain("min-w-0");
    expect(classTokens(headingRow)).toContain("space-y-3");
    expect(classTokens(card)).not.toContain("mt-20");
    expect(classTokens(card)).not.toContain("grayscale");
    expect(screen.getByText("Aposentado")).toBeInTheDocument();

    assertSocialFlow(socialContainer);

    expect(heading.compareDocumentPosition(socialContainer) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it("renderiza avatar otimizado com variants square quando disponiveis", async () => {
    render(
      <MemoryRouter>
        <Team />
      </MemoryRouter>,
    );

    const avatarImage = await screen.findByRole("img", { name: activeMemberName });
    const picture = avatarImage.parentElement;
    const sources = Array.from(picture?.querySelectorAll("source") || []);

    expect(sources).toHaveLength(2);
    expect(sources[0]).toHaveAttribute("srcset", expect.stringContaining("/square-v2.avif"));
    expect(sources[1]).toHaveAttribute("srcset", expect.stringContaining("/square-v2.webp"));
    expect(avatarImage).toHaveAttribute("src", expect.stringContaining("/square-v2.png"));
  });

  it("mantem o mesmo layout empilhado quando ha apenas membros aposentados", async () => {
    setupApiMock([usersFixture[1]]);

    render(
      <MemoryRouter>
        <Team />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: retiredMemberName });
    const { layoutStack, avatarSlot, avatarStage, contentPanel, card, socialContainer } =
      getMemberLayoutByName(retiredMemberName);

    assertResponsiveSideLayout(layoutStack, avatarSlot, avatarStage, contentPanel);
    assertSocialFlow(socialContainer);
    expect(classTokens(card)).not.toContain("mt-20");
    expect(classTokens(card)).not.toContain("grayscale");
  });
});
