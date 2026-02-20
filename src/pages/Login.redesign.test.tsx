import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Login from "@/pages/Login";

const apiFetchMock = vi.hoisted(() => vi.fn());
const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "http://api.local",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const originalLocation = window.location;
let locationHref = "http://localhost/login";

const installLocationMock = () => {
  locationHref = "http://localhost/login";
  const locationMock = {
    get href() {
      return locationHref;
    },
    set href(value: string) {
      locationHref = value;
    },
  } as unknown as Location;

  Object.defineProperty(window, "location", {
    configurable: true,
    value: locationMock,
  });
};

const mockResponse = (ok: boolean) =>
  ({
    ok,
    json: async () => ({}),
  }) as Response;

const renderLogin = (route = "/login") =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <Login />
    </MemoryRouter>,
  );

describe("Login redesign", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    navigateMock.mockReset();
    installLocationMock();
    apiFetchMock.mockResolvedValue(mockResponse(false));
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("renderiza a estrutura principal com classes de redesign", () => {
    renderLogin();

    expect(document.querySelector(".login-shell")).not.toBeNull();
    expect(document.querySelector(".login-backdrop")).not.toBeNull();
    const card = document.querySelector(".login-card");
    expect(card).not.toBeNull();
    expect(card).not.toHaveClass("p-1");
    expect(document.querySelector(".login-card-content")).not.toBeNull();
    expect(document.querySelector(".login-actions")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Entrar com Discord" })).toHaveClass(
      "w-full",
      "sm:w-auto",
    );
  });

  it("exibe mensagem de erro e atributos de acessibilidade quando error existe", () => {
    renderLogin("/login?error=state_mismatch");

    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass("login-alert");
    expect(alert).toHaveAttribute("aria-live", "polite");
    expect(alert).toHaveTextContent("Falha de segurança na autenticação. Tente novamente.");
  });

  it("monta URL de autenticacao com next no clique de entrar com Discord", () => {
    renderLogin("/login?next=/dashboard/posts");

    fireEvent.click(screen.getByRole("button", { name: "Entrar com Discord" }));

    expect(locationHref).toBe("http://api.local/auth/discord?next=%2Fdashboard%2Fposts");
  });

  it("usa fallback de autenticacao sem next", () => {
    renderLogin("/login");

    fireEvent.click(screen.getByRole("button", { name: "Entrar com Discord" }));

    expect(locationHref).toBe("http://api.local/auth/discord");
  });
});
