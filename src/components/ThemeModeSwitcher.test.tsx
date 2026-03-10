import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ThemeModeSwitcher from "@/components/ThemeModeSwitcher";
import { THEME_MODE_PRESERVE_MOTION_ATTRIBUTE } from "@/hooks/theme-mode-context";

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

  it("renderiza o toggle Classic no modo escuro com label para alternar para claro", () => {
    useThemeModeMock.mockReturnValue(createThemeState());
    const { container } = render(<ThemeModeSwitcher />);
    const button = screen.getByRole("button", { name: "Alternar para tema claro" });

    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("text-foreground/80");
    expect(button).toHaveClass("hover:bg-accent");
    expect(button).toHaveClass("hover:text-foreground");
    expect(button).not.toHaveClass("hover:text-accent-foreground");
    expect(button).toHaveClass("theme-toggle--toggled");
    expect(button).toHaveAttribute(THEME_MODE_PRESERVE_MOTION_ATTRIBUTE, "true");
    expect(container.querySelector("svg.theme-toggle__classic")).not.toBeNull();
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
    expect(container.querySelector("svg.theme-toggle__classic")).not.toBeNull();

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
