import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPages from "@/pages/DashboardPages";

const { apiFetchMock, navigateMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
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

const getPutPageCalls = () =>
  apiFetchMock.mock.calls.filter((call) => {
    const path = call[1];
    const options = (call[2] || {}) as RequestInit;
    const method = String(options.method || "GET").toUpperCase();
    return path === "/api/pages" && method === "PUT";
  });

const flushMicrotasks = async () => {
  await Promise.resolve();
};
const waitMs = (delayMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });

describe("DashboardPages autosave", () => {
  beforeEach(() => {
    window.localStorage.clear();
    apiFetchMock.mockReset();
    navigateMock.mockReset();
    apiFetchMock.mockImplementation(async (_base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (path === "/api/me") {
        return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
      }
      if (path === "/api/pages" && method === "GET") {
        return mockJsonResponse(true, {
          pages: {
            donations: {
              heroTitle: "",
              heroSubtitle: "",
              costs: [],
              reasonTitle: "",
              reasonIcon: "HeartHandshake",
              reasonText: "",
              reasonNote: "",
              pixKey: "PIX-INIT",
              pixNote: "",
              qrCustomUrl: "",
              pixIcon: "QrCode",
              donorsIcon: "PiggyBank",
              donors: [],
            },
          },
        });
      }
      if (path === "/api/pages" && method === "PUT") {
        const body = JSON.parse(String((options as RequestInit).body || "{}"));
        return mockJsonResponse(true, { pages: body.pages || {} });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("edita campo e dispara PUT /api/pages apÃ³s debounce", async () => {
    render(<DashboardPages />);
    await screen.findByRole("heading", { name: /Gerenciar/i });

    const pixInput = await screen.findByDisplayValue("PIX-INIT");
    fireEvent.change(pixInput, { target: { value: "chave-pix-autosave" } });

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });

    expect(getPutPageCalls()).toHaveLength(1);
  });

  it("toggle desligado bloqueia autosave, mas botÃ£o manual continua salvando", async () => {
    render(<DashboardPages />);
    await screen.findByRole("heading", { name: /Gerenciar/i });

    const autosaveSwitch = screen.getByRole("switch", { name: "Alternar autosave" });
    fireEvent.click(autosaveSwitch);

    const pixInput = await screen.findByDisplayValue("PIX-INIT");
    fireEvent.change(pixInput, { target: { value: "sem-autosave" } });

    await act(async () => {
      await waitMs(1300);
      await flushMicrotasks();
    });
    expect(getPutPageCalls()).toHaveLength(0);

    const manualButton = screen.getByRole("button", { name: /Salvar altera/i });
    await act(async () => {
      fireEvent.click(manualButton);
      await flushMicrotasks();
    });

    expect(getPutPageCalls()).toHaveLength(1);
  });
});

