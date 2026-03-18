import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardSettings from "@/pages/DashboardSettings";
import { defaultSettings } from "@/hooks/site-settings-context";

const { apiFetchMock, navigateMock, refreshMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  navigateMock: vi.fn(),
  refreshMock: vi.fn(async () => undefined),
}));

const settingsWithUploadIcons = {
  ...defaultSettings,
  downloads: {
    ...defaultSettings.downloads,
    sources: defaultSettings.downloads.sources.map((source, index) =>
      index === 0 ? { ...source, icon: "/uploads/downloads/google-drive.svg" } : source,
    ),
  },
};

const linkTypesResponse = [
  { id: "instagram", label: "Instagram", icon: "/uploads/socials/instagram.svg" },
];

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ImageLibraryDialog", () => ({
  default: () => null,
}));

vi.mock("@/components/ThemedSvgLogo", () => ({
  default: ({ label }: { label?: string }) => <span aria-hidden="true" data-label={label || ""} />,
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({
    settings: settingsWithUploadIcons,
    refresh: refreshMock,
  }),
}));

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "http://api.local",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

const findAncestor = (
  element: HTMLElement,
  predicate: (candidate: HTMLElement) => boolean,
): HTMLElement | null => {
  let current = element.parentElement;
  while (current) {
    if (predicate(current)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
};

const renderDashboardSettings = () =>
  render(
    <MemoryRouter initialEntries={["/dashboard/configuracoes"]}>
      <DashboardSettings />
    </MemoryRouter>,
  );

describe("DashboardSettings mobile layout", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("dashboard.autosave.settings.enabled", "false");

    apiFetchMock.mockReset();
    navigateMock.mockReset();
    refreshMock.mockClear();

    apiFetchMock.mockImplementation(async (_base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
      }
      if (path === "/api/settings" && method === "GET") {
        return mockJsonResponse(true, { settings: settingsWithUploadIcons });
      }
      if (path === "/api/public/tag-translations" && method === "GET") {
        return mockJsonResponse(true, {
          tags: {},
          genres: {},
          staffRoles: {},
        });
      }
      if (path === "/api/projects" && method === "GET") {
        return mockJsonResponse(true, { projects: [] });
      }
      if (path === "/api/link-types" && method === "GET") {
        return mockJsonResponse(true, { items: linkTypesResponse });
      }
      if (path === "/api/settings" && method === "PUT") {
        const request = (options || {}) as RequestInit & { json?: unknown };
        const payload =
          (request.json as { settings?: unknown } | undefined) ||
          JSON.parse(String(request.body || "{}"));
        return mockJsonResponse(true, { settings: payload.settings || settingsWithUploadIcons });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("uses compact mobile cards for download sources while keeping desktop grid classes", async () => {
    renderDashboardSettings();
    await screen.findByRole("heading", { name: /Painel/i });

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Downloads/i }));
    await screen.findByRole("heading", { name: /Fontes de download/i });

    const nameInput = screen.getByDisplayValue("Google Drive");
    const card = findAncestor(nameInput, (candidate) =>
      classTokens(candidate).includes("md:grid-cols-[1.2fr_0.25fr_0.6fr_1.6fr_auto]"),
    );

    expect(card).not.toBeNull();
    const cardTokens = classTokens(card as HTMLElement);
    expect(cardTokens).toContain("rounded-2xl");
    expect(cardTokens).toContain("border");
    expect(cardTokens).toContain("p-3");
    expect(cardTokens).toContain("shadow-sm");
    expect(cardTokens).toContain("md:items-center");
    expect(cardTokens).not.toContain("items-center");
    expect(nameInput.parentElement).toBe(card);

    const tintSwitch = within(card as HTMLElement).getByRole("switch", {
      name: /Colorir SVG de Google Drive/i,
    });
    const tintRow = findAncestor(
      tintSwitch,
      (candidate) =>
        classTokens(candidate).includes("justify-between") &&
        classTokens(candidate).includes("md:justify-center"),
    );

    expect(tintRow).not.toBeNull();
    const tintRowTokens = classTokens(tintRow as HTMLElement);
    expect(tintRowTokens).toContain("min-w-0");
    expect(tintRowTokens).toContain("px-3");
    expect(tintRowTokens).toContain("py-1.5");
    expect(tintRowTokens).toContain("rounded-xl");

    const pickerRow = tintRow?.parentElement as HTMLElement | null;
    expect(pickerRow).not.toBeNull();
    const pickerRowTokens = classTokens(pickerRow as HTMLElement);
    expect(pickerRowTokens).toContain("grid");
    expect(pickerRowTokens).toContain("grid-cols-[auto_minmax(0,1fr)]");
    expect(pickerRowTokens).toContain("md:contents");
    expect(pickerRow?.parentElement).toBe(card as HTMLElement);

    const colorShell = pickerRow?.firstElementChild as HTMLElement | null;
    expect(colorShell).not.toBeNull();
    const colorShellTokens = classTokens(colorShell as HTMLElement);
    expect(colorShellTokens).toContain("w-auto");
    expect(colorShellTokens).toContain("justify-start");

    const colorButton = colorShell?.querySelector("button");
    expect(colorButton).not.toBeNull();
    const colorButtonTokens = classTokens(colorButton as HTMLElement);
    expect(colorButtonTokens).toContain("h-8");
    expect(colorButtonTokens).toContain("w-8");
    expect(colorButtonTokens).toContain("md:h-9");
    expect(colorButtonTokens).toContain("md:w-9");

    const uploadLabel = within(card as HTMLElement).getByText("Escolher SVG");
    expect(uploadLabel).toHaveAttribute("for", "download-icon-0");
    const uploadLabelTokens = classTokens(uploadLabel as HTMLElement);
    expect(uploadLabelTokens).toContain("h-7");
    expect(uploadLabelTokens).toContain("px-2.5");
    expect(uploadLabelTokens).toContain("text-[10px]");
    expect(uploadLabelTokens).toContain("md:h-8");
    expect(uploadLabelTokens).toContain("md:px-3");

    const previewRow = findAncestor(
      uploadLabel,
      (candidate) =>
        classTokens(candidate).includes("text-muted-foreground") &&
        classTokens(candidate).includes("rounded-xl") &&
        classTokens(candidate).includes("min-w-0"),
    );

    expect(previewRow).not.toBeNull();
    expect(previewRow?.parentElement).toBe(card as HTMLElement);

    const previewStatus = within(previewRow as HTMLElement).getByText("SVG atual");
    const previewStatusTokens = classTokens(previewStatus as HTMLElement);
    expect(previewStatusTokens).toContain("flex-1");
    expect(previewStatusTokens).toContain("truncate");

    const uploadActionCluster = uploadLabel.parentElement as HTMLElement | null;
    expect(uploadActionCluster).not.toBeNull();
    expect(uploadActionCluster?.parentElement).toBe(previewRow as HTMLElement);
    const uploadActionTokens = classTokens(uploadActionCluster as HTMLElement);
    expect(uploadActionTokens).toContain("ml-auto");
    expect(uploadActionTokens).toContain("gap-1.5");
    expect(uploadActionTokens).toContain("md:gap-2");

    const mobileRemoveButton = Array.from(
      (uploadActionCluster as HTMLElement).querySelectorAll("button"),
    ).find((candidate) => classTokens(candidate as HTMLElement).includes("text-destructive"));
    expect(mobileRemoveButton).toBeDefined();
    const mobileRemoveButtonTokens = classTokens(mobileRemoveButton as HTMLElement);
    expect(mobileRemoveButtonTokens).toContain("h-7");
    expect(mobileRemoveButtonTokens).toContain("w-7");
    expect(mobileRemoveButtonTokens).toContain("md:hidden");

    const desktopRemoveButton = Array.from((card as HTMLElement).querySelectorAll("button")).find(
      (candidate) => classTokens(candidate as HTMLElement).includes("md:inline-flex"),
    );
    expect(desktopRemoveButton).toBeDefined();
    expect(desktopRemoveButton?.parentElement).toBe(card as HTMLElement);
    const desktopRemoveButtonTokens = classTokens(desktopRemoveButton as HTMLElement);
    expect(desktopRemoveButtonTokens).toContain("hidden");
    expect(desktopRemoveButtonTokens).toContain("md:inline-flex");
  });

  it("uses the same compact mobile card pattern for social link types", async () => {
    renderDashboardSettings();
    await screen.findByRole("heading", { name: /Painel/i });

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Redes/i }));
    await screen.findByRole("heading", { name: /Redes sociais/i });

    const nameInput = screen.getByDisplayValue("Instagram");
    const card = findAncestor(nameInput, (candidate) =>
      classTokens(candidate).includes("md:grid-cols-[1fr_1.6fr_auto]"),
    );

    expect(card).not.toBeNull();
    const cardTokens = classTokens(card as HTMLElement);
    expect(cardTokens).toContain("rounded-2xl");
    expect(cardTokens).toContain("border");
    expect(cardTokens).toContain("p-3");
    expect(cardTokens).toContain("shadow-sm");
    expect(cardTokens).toContain("md:items-center");
    expect(cardTokens).not.toContain("items-center");
    expect(nameInput.parentElement).toBe(card);

    const uploadLabel = within(card as HTMLElement).getByText("Escolher SVG");
    expect(uploadLabel).toHaveAttribute("for", "linktype-icon-0");
    const uploadLabelTokens = classTokens(uploadLabel as HTMLElement);
    expect(uploadLabelTokens).toContain("h-7");
    expect(uploadLabelTokens).toContain("px-2.5");
    expect(uploadLabelTokens).toContain("text-[10px]");
    expect(uploadLabelTokens).toContain("md:h-8");
    expect(uploadLabelTokens).toContain("md:px-3");

    const previewRow = findAncestor(
      uploadLabel,
      (candidate) =>
        classTokens(candidate).includes("text-muted-foreground") &&
        classTokens(candidate).includes("rounded-xl") &&
        classTokens(candidate).includes("min-w-0"),
    );

    expect(previewRow).not.toBeNull();
    expect(previewRow?.parentElement).toBe(card as HTMLElement);

    const previewStatus = within(previewRow as HTMLElement).getByText("SVG atual");
    const previewStatusTokens = classTokens(previewStatus as HTMLElement);
    expect(previewStatusTokens).toContain("flex-1");
    expect(previewStatusTokens).toContain("truncate");

    const uploadActionCluster = uploadLabel.parentElement as HTMLElement | null;
    expect(uploadActionCluster).not.toBeNull();
    expect(uploadActionCluster?.parentElement).toBe(previewRow as HTMLElement);
    const uploadActionTokens = classTokens(uploadActionCluster as HTMLElement);
    expect(uploadActionTokens).toContain("ml-auto");
    expect(uploadActionTokens).toContain("gap-1.5");
    expect(uploadActionTokens).toContain("md:gap-2");

    const mobileRemoveButton = Array.from(
      (uploadActionCluster as HTMLElement).querySelectorAll("button"),
    ).find((candidate) => classTokens(candidate as HTMLElement).includes("text-destructive"));
    expect(mobileRemoveButton).toBeDefined();
    const mobileRemoveButtonTokens = classTokens(mobileRemoveButton as HTMLElement);
    expect(mobileRemoveButtonTokens).toContain("h-7");
    expect(mobileRemoveButtonTokens).toContain("w-7");
    expect(mobileRemoveButtonTokens).toContain("md:hidden");

    const desktopRemoveButton = Array.from((card as HTMLElement).querySelectorAll("button")).find(
      (candidate) => classTokens(candidate as HTMLElement).includes("md:inline-flex"),
    );
    expect(desktopRemoveButton).toBeDefined();
    expect(desktopRemoveButton?.parentElement).toBe(card as HTMLElement);
    const desktopRemoveButtonTokens = classTokens(desktopRemoveButton as HTMLElement);
    expect(desktopRemoveButtonTokens).toContain("hidden");
    expect(desktopRemoveButtonTokens).toContain("md:inline-flex");
  });

  it("uses compact mobile cards for team roles and navbar links", async () => {
    renderDashboardSettings();
    await screen.findByRole("heading", { name: /Painel/i });

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Equipe/i }));
    await screen.findByRole("heading", { name: /Fun/i });

    const teamNameInput = screen.getByDisplayValue("Tradutor");
    const teamCard = findAncestor(teamNameInput, (candidate) =>
      classTokens(candidate).includes("md:grid-cols-[1.4fr_1fr_auto]"),
    );

    expect(teamCard).not.toBeNull();
    const teamCardTokens = classTokens(teamCard as HTMLElement);
    expect(teamCardTokens).toContain("rounded-2xl");
    expect(teamCardTokens).toContain("border");
    expect(teamCardTokens).toContain("p-3");
    expect(teamCardTokens).toContain("shadow-sm");
    expect(teamCardTokens).toContain("md:items-center");

    const teamSelectTrigger = within(teamCard as HTMLElement).getByRole("combobox");
    const teamSelectTokens = classTokens(teamSelectTrigger as HTMLElement);
    expect(teamSelectTokens).toContain("w-full");
    expect(teamSelectTokens).toContain("min-w-0");

    const teamRemoveButton = Array.from((teamCard as HTMLElement).querySelectorAll("button")).find(
      (candidate) => classTokens(candidate as HTMLElement).includes("text-destructive"),
    );
    expect(teamRemoveButton).toBeDefined();
    const teamRemoveTokens = classTokens(teamRemoveButton as HTMLElement);
    expect(teamRemoveTokens).toContain("h-7");
    expect(teamRemoveTokens).toContain("w-7");
    expect(teamRemoveTokens).toContain("justify-self-end");
    expect(teamRemoveTokens).toContain("md:h-10");
    expect(teamRemoveTokens).toContain("md:w-10");
    expect(teamRemoveTokens).toContain("md:justify-self-auto");

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Layout/i }));
    const navbarHeading = await screen.findByRole("heading", { name: /Links do menu/i });
    const navbarCardContent = navbarHeading.closest("div.space-y-6") as HTMLElement | null;
    expect(navbarCardContent).not.toBeNull();

    const navbarLabelInput = within(navbarCardContent as HTMLElement).getByDisplayValue("Projetos");
    const navbarCard = findAncestor(navbarLabelInput, (candidate) =>
      classTokens(candidate).includes("md:grid-cols-[0.85fr_1fr_1.6fr_auto]"),
    );

    expect(navbarCard).not.toBeNull();
    const navbarCardTokens = classTokens(navbarCard as HTMLElement);
    expect(navbarCardTokens).toContain("rounded-2xl");
    expect(navbarCardTokens).toContain("border");
    expect(navbarCardTokens).toContain("p-3");
    expect(navbarCardTokens).toContain("shadow-sm");
    expect(navbarCardTokens).toContain("md:items-center");

    const navbarSelectTrigger = within(navbarCard as HTMLElement).getByRole("combobox");
    const navbarSelectTokens = classTokens(navbarSelectTrigger as HTMLElement);
    expect(navbarSelectTokens).toContain("w-full");
    expect(navbarSelectTokens).toContain("min-w-0");

    const navbarUrlInput = within(navbarCard as HTMLElement).getByDisplayValue("/projetos");
    expect(navbarUrlInput).toBeInTheDocument();

    const navbarRemoveButton = Array.from(
      (navbarCard as HTMLElement).querySelectorAll("button"),
    ).find((candidate) => classTokens(candidate as HTMLElement).includes("text-destructive"));
    expect(navbarRemoveButton).toBeDefined();
    const navbarRemoveTokens = classTokens(navbarRemoveButton as HTMLElement);
    expect(navbarRemoveTokens).toContain("h-7");
    expect(navbarRemoveTokens).toContain("w-7");
    expect(navbarRemoveTokens).toContain("justify-self-end");
    expect(navbarRemoveTokens).toContain("md:justify-self-auto");
  });

  it("uses compact mobile cards across footer columns, social links, and legal text rows", async () => {
    renderDashboardSettings();
    await screen.findByRole("heading", { name: /Painel/i });

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Layout/i }));
    await screen.findByRole("heading", { name: /Conte/i });

    const columnTitleInput = screen.getByDisplayValue("Nekomata");
    const columnCard = findAncestor(
      columnTitleInput,
      (candidate) =>
        classTokens(candidate).includes("bg-background/50") &&
        classTokens(candidate).includes("rounded-2xl"),
    );
    expect(columnCard).not.toBeNull();
    const columnCardTokens = classTokens(columnCard as HTMLElement);
    expect(columnCardTokens).toContain("p-3");
    expect(columnCardTokens).toContain("space-y-3");
    expect(columnCardTokens).toContain("md:p-4");
    expect(columnCardTokens).toContain("md:space-y-4");

    const columnHeaderRemove = Array.from(
      (columnCard as HTMLElement).querySelectorAll("button"),
    ).find((candidate) => classTokens(candidate as HTMLElement).includes("self-end"));
    expect(columnHeaderRemove).toBeDefined();
    const columnHeaderRemoveTokens = classTokens(columnHeaderRemove as HTMLElement);
    expect(columnHeaderRemoveTokens).toContain("h-7");
    expect(columnHeaderRemoveTokens).toContain("w-7");
    expect(columnHeaderRemoveTokens).toContain("self-end");
    expect(columnHeaderRemoveTokens).toContain("md:self-auto");

    const footerLinkInput = within(columnCard as HTMLElement).getByDisplayValue("Sobre");
    const footerLinkCard = findAncestor(footerLinkInput, (candidate) =>
      classTokens(candidate).includes("md:grid-cols-[1fr_1.6fr_auto]"),
    );
    expect(footerLinkCard).not.toBeNull();
    const footerLinkCardTokens = classTokens(footerLinkCard as HTMLElement);
    expect(footerLinkCardTokens).toContain("rounded-2xl");
    expect(footerLinkCardTokens).toContain("border");
    expect(footerLinkCardTokens).toContain("p-3");
    expect(footerLinkCardTokens).toContain("shadow-sm");

    const footerLinkRemove = Array.from(
      (footerLinkCard as HTMLElement).querySelectorAll("button"),
    ).find((candidate) => classTokens(candidate as HTMLElement).includes("text-destructive"));
    expect(footerLinkRemove).toBeDefined();
    const footerLinkRemoveTokens = classTokens(footerLinkRemove as HTMLElement);
    expect(footerLinkRemoveTokens).toContain("justify-self-end");
    expect(footerLinkRemoveTokens).toContain("md:justify-self-auto");

    const footerSocialRow = screen.getByTestId("footer-social-row-0");
    const footerSocialRowTokens = classTokens(footerSocialRow);
    expect(footerSocialRowTokens).toContain("rounded-2xl");
    expect(footerSocialRowTokens).toContain("p-3");
    expect(footerSocialRowTokens).toContain("shadow-sm");
    expect(footerSocialRowTokens).toContain("md:overflow-x-auto");
    expect(footerSocialRowTokens).not.toContain("overflow-x-auto");

    const footerSocialGrid = Array.from(footerSocialRow.querySelectorAll("div")).find((candidate) =>
      classTokens(candidate as HTMLElement).includes("md:min-w-[720px]"),
    );
    expect(footerSocialGrid).not.toBeNull();
    const footerSocialGridTokens = classTokens(footerSocialGrid as HTMLElement);
    expect(footerSocialGridTokens).toContain("grid");
    expect(footerSocialGridTokens).toContain("md:min-w-[720px]");

    const footerSocialTopRow = Array.from(footerSocialRow.querySelectorAll("div")).find(
      (candidate) => classTokens(candidate as HTMLElement).includes("grid-cols-[auto_1fr_auto]"),
    );
    expect(footerSocialTopRow).not.toBeNull();
    const footerSocialTopRowTokens = classTokens(footerSocialTopRow as HTMLElement);
    expect(footerSocialTopRowTokens).toContain("md:contents");

    const footerSocialDragButton = within(footerSocialTopRow as HTMLElement).getByRole("button", {
      name: /Arrastar rede Instagram/i,
    });
    const footerSocialDragTokens = classTokens(footerSocialDragButton as HTMLElement);
    expect(footerSocialDragTokens).toContain("h-7");
    expect(footerSocialDragTokens).toContain("w-7");
    expect(footerSocialDragTokens).toContain("md:h-9");
    expect(footerSocialDragTokens).toContain("md:w-9");

    const footerSocialMobileRemove = Array.from(
      (footerSocialTopRow as HTMLElement).querySelectorAll("button"),
    ).find((candidate) => classTokens(candidate as HTMLElement).includes("md:hidden"));
    expect(footerSocialMobileRemove).toBeDefined();
    const footerSocialDesktopRemove = Array.from(footerSocialRow.querySelectorAll("button")).find(
      (candidate) => classTokens(candidate as HTMLElement).includes("md:inline-flex"),
    );
    expect(footerSocialDesktopRemove).toBeDefined();

    const legalHeading = screen.getByRole("heading", { name: /Textos legais/i });
    const legalCardContent = legalHeading.parentElement?.parentElement as HTMLElement | null;
    expect(legalCardContent).not.toBeNull();
    const legalCardTokens = classTokens(legalCardContent as HTMLElement);
    expect(legalCardTokens).toContain("space-y-4");
    expect(legalCardTokens).toContain("p-4");
    expect(legalCardTokens).toContain("md:space-y-6");
    expect(legalCardTokens).toContain("md:p-6");

    const disclaimerTextarea = within(legalCardContent as HTMLElement).getByDisplayValue(
      /Todo o conte/i,
    );
    const disclaimerCard = findAncestor(disclaimerTextarea, (candidate) =>
      classTokens(candidate).includes("md:grid-cols-[1fr_auto]"),
    );
    expect(disclaimerCard).not.toBeNull();
    const disclaimerCardTokens = classTokens(disclaimerCard as HTMLElement);
    expect(disclaimerCardTokens).toContain("rounded-2xl");
    expect(disclaimerCardTokens).toContain("border");
    expect(disclaimerCardTokens).toContain("p-3");
    expect(disclaimerCardTokens).toContain("shadow-sm");
    expect(disclaimerCardTokens).toContain("md:items-start");

    const disclaimerTextareaTokens = classTokens(disclaimerTextarea as HTMLElement);
    expect(disclaimerTextareaTokens).toContain("min-h-[96px]");
    expect(disclaimerTextareaTokens).toContain("md:min-h-[80px]");

    const disclaimerRemove = Array.from(
      (disclaimerCard as HTMLElement).querySelectorAll("button"),
    ).find((candidate) => classTokens(candidate as HTMLElement).includes("text-destructive"));
    expect(disclaimerRemove).toBeDefined();
    const disclaimerRemoveTokens = classTokens(disclaimerRemove as HTMLElement);
    expect(disclaimerRemoveTokens).toContain("justify-self-end");
    expect(disclaimerRemoveTokens).toContain("md:justify-self-auto");

    const addParagraphButton = within(legalCardContent as HTMLElement).getByRole("button", {
      name: /Adicionar par/i,
    });
    const addParagraphTokens = classTokens(addParagraphButton as HTMLElement);
    expect(addParagraphTokens).toContain("w-full");
    expect(addParagraphTokens).toContain("md:w-auto");

    const highlightInput = within(legalCardContent as HTMLElement).getByDisplayValue(/Atribui/i);
    const highlightGrid = findAncestor(highlightInput, (candidate) =>
      classTokens(candidate).includes("md:grid-cols-2"),
    );
    expect(highlightGrid).not.toBeNull();
    const highlightGridTokens = classTokens(highlightGrid as HTMLElement);
    expect(highlightGridTokens).toContain("gap-3");
    expect(highlightGridTokens).toContain("md:gap-4");
  });
});
