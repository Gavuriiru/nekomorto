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

const getSocialContainerByMemberName = (memberName: string) => {
  const heading = screen.getByRole("heading", { name: memberName });
  const contentPanel = heading.closest("div.rounded-2xl");
  expect(contentPanel).not.toBeNull();

  const layoutRow = contentPanel?.parentElement as HTMLElement | null;
  expect(layoutRow).not.toBeNull();

  const avatarColumn = layoutRow?.firstElementChild as HTMLElement | null;
  expect(avatarColumn).not.toBeNull();

  const avatarStage = avatarColumn?.firstElementChild as HTMLElement | null;
  expect(avatarStage).not.toBeNull();

  const links = within(contentPanel as HTMLElement).getAllByRole("link");
  expect(links.length).toBeGreaterThan(0);

  const socialContainer = links[0]?.parentElement as HTMLElement | null;
  expect(socialContainer).not.toBeNull();

  return {
    heading,
    headingRow: heading.parentElement as HTMLElement,
    layoutRow: layoutRow as HTMLElement,
    avatarColumn: avatarColumn as HTMLElement,
    avatarStage: avatarStage as HTMLElement,
    socialContainer: socialContainer as HTMLElement,
  };
};

const assertTabletStructure = (layoutRow: HTMLElement, avatarColumn: HTMLElement, avatarStage: HTMLElement) => {
  const layoutTokens = classTokens(layoutRow);
  expect(layoutTokens).toContain("lg:flex-row");
  expect(layoutTokens).not.toContain("sm:flex-row");
  expect(layoutTokens).not.toContain("md:flex-row");

  const avatarColumnTokens = classTokens(avatarColumn);
  expect(avatarColumnTokens).toContain("lg:w-80");
  expect(avatarColumnTokens).not.toContain("sm:w-56");
  expect(avatarColumnTokens).not.toContain("md:w-72");

  const avatarStageTokens = classTokens(avatarStage);
  expect(avatarStageTokens).toContain("sm:h-72");
  expect(avatarStageTokens).toContain("md:h-80");
  expect(avatarStageTokens).toContain("lg:h-full");
  expect(avatarStageTokens).not.toContain("sm:h-full");
};

const setupApiMock = () => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();

    if (endpoint === "/api/public/users" && method === "GET") {
      return mockJsonResponse(true, {
        users: usersFixture,
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
    const { heading, headingRow, layoutRow, avatarColumn, avatarStage, socialContainer } =
      getSocialContainerByMemberName(activeMemberName);

    assertTabletStructure(layoutRow, avatarColumn, avatarStage);

    expect(classTokens(heading)).toContain("break-words");
    expect(classTokens(headingRow)).toContain("min-w-0");
    expect(classTokens(headingRow)).toContain("lg:pr-44");

    const socialTokens = classTokens(socialContainer);
    expect(socialTokens).toContain("lg:absolute");
    expect(socialTokens).not.toContain("absolute");
    expect(socialTokens).not.toContain("sm:absolute");
    expect(socialTokens).not.toContain("md:absolute");
    expect(socialTokens).toContain("justify-start");
    expect(socialTokens).toContain("gap-3");
    expect(socialTokens).toContain("flex-wrap");
    expect(socialTokens).not.toContain("mt-2");
    expect(socialTokens).toContain("lg:mt-0");

    expect(heading.compareDocumentPosition(socialContainer) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it("aplica a mesma regra responsiva para redes no card aposentado", async () => {
    render(
      <MemoryRouter>
        <Team />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: retiredMemberName });
    const { heading, headingRow, layoutRow, avatarColumn, avatarStage, socialContainer } =
      getSocialContainerByMemberName(retiredMemberName);

    assertTabletStructure(layoutRow, avatarColumn, avatarStage);

    expect(classTokens(heading)).toContain("break-words");
    expect(classTokens(headingRow)).toContain("min-w-0");
    expect(classTokens(headingRow)).toContain("lg:pr-44");

    const socialTokens = classTokens(socialContainer);
    expect(socialTokens).toContain("lg:absolute");
    expect(socialTokens).not.toContain("absolute");
    expect(socialTokens).not.toContain("sm:absolute");
    expect(socialTokens).not.toContain("md:absolute");
    expect(socialTokens).toContain("justify-start");
    expect(socialTokens).toContain("gap-3");
    expect(socialTokens).toContain("flex-wrap");
    expect(socialTokens).not.toContain("mt-2");
    expect(socialTokens).toContain("lg:mt-0");

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
});
