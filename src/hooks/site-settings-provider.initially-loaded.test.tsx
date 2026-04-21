import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SiteSettingsProvider } from "@/hooks/site-settings-provider";
import { useSiteSettings } from "@/hooks/use-site-settings";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const Consumer = () => {
  const { isLoading, settings } = useSiteSettings();
  return (
    <div>
      <span data-testid="loading-state">{isLoading ? "loading" : "idle"}</span>
      <span data-testid="site-name">{settings.site?.name || ""}</span>
    </div>
  );
};

describe("SiteSettingsProvider initiallyLoaded", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("revalida via /api/public/bootstrap quando initiallyLoaded=true", async () => {
    apiFetchMock.mockResolvedValue(
      mockJsonResponse(true, {
        settings: {
          site: { name: "Nekomata API" },
        },
      }),
    );

    render(
      <SiteSettingsProvider initialSettings={{ site: { name: "Nekomata" } } as any} initiallyLoaded>
        <Consumer />
      </SiteSettingsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading-state")).toHaveTextContent("idle");
    });
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("", "/api/public/bootstrap");
    });
    expect(screen.getByTestId("site-name")).toHaveTextContent("Nekomata");
  });

  it("carrega configuracoes quando inicialmente nao carregado", async () => {
    apiFetchMock.mockResolvedValue(
      mockJsonResponse(true, {
        settings: {
          site: { name: "Nekomata API" },
        },
      }),
    );

    render(
      <SiteSettingsProvider>
        <Consumer />
      </SiteSettingsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("site-name")).toHaveTextContent("Nekomata API");
    });
  });
});
