import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ThemeModeSwitcher from "@/components/ThemeModeSwitcher";

const setPreferenceMock = vi.hoisted(() => vi.fn());
const useThemeModeMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-theme-mode", () => ({
  useThemeMode: () => useThemeModeMock(),
}));

const createThemeState = (override: Record<string, unknown> = {}) => ({
  globalMode: "dark",
  effectiveMode: "dark",
  preference: "global",
  isOverridden: false,
  setPreference: setPreferenceMock,
  ...override,
});

describe("ThemeModeSwitcher", () => {
  beforeEach(() => {
    setPreferenceMock.mockReset();
    useThemeModeMock.mockReset();
  });

  it("exibe lua no modo escuro e label para alternar para claro", () => {
    useThemeModeMock.mockReturnValue(createThemeState());
    const { container } = render(<ThemeModeSwitcher />);

    expect(screen.getByRole("button", { name: "Alternar para tema claro" })).toBeInTheDocument();
    expect(container.querySelector("svg.lucide-moon")).not.toBeNull();
  });

  it("em global dark alterna para light", () => {
    useThemeModeMock.mockReturnValue(createThemeState({ globalMode: "dark", effectiveMode: "dark" }));
    render(<ThemeModeSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "Alternar para tema claro" }));

    expect(setPreferenceMock).toHaveBeenCalledTimes(1);
    expect(setPreferenceMock).toHaveBeenCalledWith("light");
  });

  it("em override light com global dark volta para global", () => {
    useThemeModeMock.mockReturnValue(
      createThemeState({
        globalMode: "dark",
        effectiveMode: "light",
        preference: "light",
        isOverridden: true,
      }),
    );
    const { container } = render(<ThemeModeSwitcher />);

    expect(screen.getByRole("button", { name: "Alternar para tema escuro" })).toBeInTheDocument();
    expect(container.querySelector("svg.lucide-sun")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Alternar para tema escuro" }));

    expect(setPreferenceMock).toHaveBeenCalledTimes(1);
    expect(setPreferenceMock).toHaveBeenCalledWith("global");
  });

  it("em global light alterna para dark", () => {
    useThemeModeMock.mockReturnValue(createThemeState({ globalMode: "light", effectiveMode: "light" }));
    render(<ThemeModeSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "Alternar para tema escuro" }));

    expect(setPreferenceMock).toHaveBeenCalledTimes(1);
    expect(setPreferenceMock).toHaveBeenCalledWith("dark");
  });
});
