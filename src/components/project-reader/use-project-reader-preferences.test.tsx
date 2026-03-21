import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useProjectReaderPreferences } from "@/components/project-reader/use-project-reader-preferences";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const STORAGE_KEY = "public.reader.preferences";

const HookHarness = ({
  projectType,
  baseConfig,
  currentUserId = null,
}: {
  projectType: string;
  baseConfig: Record<string, unknown>;
  currentUserId?: string | null;
}) => {
  const { isLoaded, resolvedConfig, updateConfig } = useProjectReaderPreferences({
    projectType,
    baseConfig,
    currentUserId,
  });

  return (
    <div>
      <div data-testid="loaded">{String(isLoaded)}</div>
      <div data-testid="layout">{String(resolvedConfig.layout || "")}</div>
      <div data-testid="progress-style">{String(resolvedConfig.progressStyle || "")}</div>
      <div data-testid="site-header-variant">{String(resolvedConfig.siteHeaderVariant || "")}</div>
      <button type="button" onClick={() => void updateConfig({ layout: "double" })}>
        set-double
      </button>
      <button type="button" onClick={() => void updateConfig({ layout: "scroll-horizontal" })}>
        set-horizontal
      </button>
      <button type="button" onClick={() => void updateConfig({ siteHeaderVariant: "fixed" })}>
        set-fixed-header
      </button>
    </div>
  );
};

describe("useProjectReaderPreferences", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("usa localStorage para visitantes e reaplica preferencias ao mudar a base do capitulo", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        reader: {
          projectTypes: {
            manga: {
              layout: "double",
              direction: "rtl",
              progressStyle: "glow",
            },
          },
        },
      }),
    );

    const { rerender } = render(
      <HookHarness projectType="manga" baseConfig={{ layout: "single" }} />,
    );

    await waitFor(() => expect(screen.getByTestId("loaded")).toHaveTextContent("true"));
    expect(screen.getByTestId("layout")).toHaveTextContent("double");
    expect(screen.getByTestId("progress-style")).toHaveTextContent("default");
    expect(screen.getByTestId("site-header-variant")).toHaveTextContent("static");

    fireEvent.click(screen.getByRole("button", { name: "set-fixed-header" }));
    await waitFor(() =>
      expect(screen.getByTestId("site-header-variant")).toHaveTextContent("fixed"),
    );

    fireEvent.click(screen.getByRole("button", { name: "set-horizontal" }));

    await waitFor(() =>
      expect(screen.getByTestId("layout")).toHaveTextContent("scroll-horizontal"),
    );

    const storedValue = JSON.parse(String(window.localStorage.getItem(STORAGE_KEY) || "{}"));
    expect(storedValue.reader.projectTypes.manga.layout).toBe("scroll-horizontal");
    expect(storedValue.reader.projectTypes.manga.progressStyle).toBe("default");
    expect(storedValue.reader.projectTypes.manga.siteHeaderVariant).toBe("fixed");

    rerender(
      <HookHarness projectType="manga" baseConfig={{ layout: "single", progressStyle: "glow" }} />,
    );

    expect(screen.getByTestId("layout")).toHaveTextContent("scroll-horizontal");
    expect(screen.getByTestId("progress-style")).toHaveTextContent("default");
    expect(screen.getByTestId("site-header-variant")).toHaveTextContent("fixed");
  });

  it("usa /api/me/preferences para usuarios autenticados", async () => {
    apiFetchMock.mockImplementation(
      async (_apiBase: string, endpoint: string, options?: { method?: string; json?: unknown }) => {
        if (endpoint === "/api/me/preferences" && (!options?.method || options.method === "GET")) {
          return {
            ok: true,
            json: async () => ({
              preferences: {
                reader: {
                  projectTypes: {
                    webtoon: {
                      layout: "scroll-horizontal",
                      direction: "ltr",
                    },
                  },
                },
              },
            }),
          };
        }

        if (endpoint === "/api/me/preferences" && options?.method === "PUT") {
          return {
            ok: true,
            json: async () => ({
              preferences: (options?.json as { preferences?: unknown })?.preferences || {},
            }),
          };
        }

        return {
          ok: false,
          json: async () => ({ error: "not_found" }),
        };
      },
    );

    render(
      <HookHarness
        projectType="webtoon"
        baseConfig={{ layout: "scroll-vertical" }}
        currentUserId="user-1"
      />,
    );

    await waitFor(() => expect(screen.getByTestId("loaded")).toHaveTextContent("true"));
    expect(screen.getByTestId("layout")).toHaveTextContent("scroll-horizontal");
    expect(screen.getByTestId("site-header-variant")).toHaveTextContent("fixed");

    fireEvent.click(screen.getByRole("button", { name: "set-double" }));

    await waitFor(() => {
      const putCall = apiFetchMock.mock.calls.find(
        (call) => call[1] === "/api/me/preferences" && call[2]?.method === "PUT",
      );
      expect(putCall).toBeDefined();
      expect(putCall?.[2]?.json).toMatchObject({
        preferences: {
          reader: {
            projectTypes: {
              webtoon: {
                layout: "double",
              },
            },
          },
        },
      });
    });
  });
});
