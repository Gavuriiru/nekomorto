import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { SiteSettings } from "@/types/site-settings";
import { defaultSettings, mergeSettings, SiteSettingsContext } from "@/hooks/site-settings-context";
import { resolveRouteThemeColor } from "@/lib/route-theme-color";
import {
  THEME_MODE_STORAGE_KEY,
  type ThemeModePreference,
} from "@/hooks/theme-mode-context";
import { ThemeModeProvider } from "@/hooks/theme-mode-provider";
import { useThemeMode } from "@/hooks/use-theme-mode";

const createSettings = (override: Partial<SiteSettings> = {}) => mergeSettings(defaultSettings, override);

const ThemeProbe = () => {
  const { globalMode, effectiveMode, preference, setPreference } = useThemeMode();

  return (
    <div>
      <p data-testid="global-mode">{globalMode}</p>
      <p data-testid="effective-mode">{effectiveMode}</p>
      <p data-testid="preference">{preference}</p>
      <button type="button" onClick={() => setPreference("global")}>
        set-global
      </button>
      <button type="button" onClick={() => setPreference("light")}>
        set-light
      </button>
      <button type="button" onClick={() => setPreference("dark")}>
        set-dark
      </button>
    </div>
  );
};

const renderWithSettings = (settings: SiteSettings) =>
  render(
    <SiteSettingsContext.Provider
      value={{
        settings,
        isLoading: false,
        refresh: async () => undefined,
      }}
    >
      <ThemeModeProvider>
        <ThemeProbe />
      </ThemeModeProvider>
    </SiteSettingsContext.Provider>,
  );

const assertDocumentTheme = (mode: "light" | "dark") => {
  expect(document.documentElement.dataset.themeMode).toBe(mode);
  expect(document.documentElement.style.colorScheme).toBe(mode);
  expect(document.documentElement.classList.contains("dark")).toBe(mode === "dark");
};

const assertThemeColor = (color: string) => {
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  expect(themeColorMeta?.getAttribute("content")).toBe(
    resolveRouteThemeColor({
      pathname: window.location.pathname,
      accentHex: color,
    }),
  );
};

describe("ThemeModeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
    document.documentElement.classList.remove("dark");
    delete document.documentElement.dataset.themeMode;
    document.documentElement.style.colorScheme = "";
    let themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeColorMeta) {
      themeColorMeta = document.createElement("meta");
      themeColorMeta.setAttribute("name", "theme-color");
      document.head.appendChild(themeColorMeta);
    }
    themeColorMeta.setAttribute("content", "");
  });

  it("follows global mode when preference is global", async () => {
    renderWithSettings(createSettings({ theme: { accent: "#9667e0", mode: "light" } }));

    expect(screen.getByTestId("global-mode")).toHaveTextContent("light");
    expect(screen.getByTestId("effective-mode")).toHaveTextContent("light");
    expect(screen.getByTestId("preference")).toHaveTextContent("global");
    assertDocumentTheme("light");
    assertThemeColor("#9667e0");
  });

  it("keeps local override above global mode", async () => {
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, "dark");
    renderWithSettings(createSettings({ theme: { accent: "#9667e0", mode: "light" } }));

    expect(screen.getByTestId("global-mode")).toHaveTextContent("light");
    expect(screen.getByTestId("effective-mode")).toHaveTextContent("dark");
    expect(screen.getByTestId("preference")).toHaveTextContent("dark");
    assertDocumentTheme("dark");
    assertThemeColor("#9667e0");
  });

  it("returns to global mode after clearing override", async () => {
    renderWithSettings(createSettings({ theme: { accent: "#9667e0", mode: "light" } }));

    fireEvent.click(screen.getByRole("button", { name: "set-dark" }));
    expect(screen.getByTestId("effective-mode")).toHaveTextContent("dark");
    expect(window.localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe("dark");
    assertDocumentTheme("dark");

    fireEvent.click(screen.getByRole("button", { name: "set-global" }));

    await waitFor(() => {
      expect(screen.getByTestId("effective-mode")).toHaveTextContent("light");
    });
    expect(screen.getByTestId("preference")).toHaveTextContent("global");
    expect(window.localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBeNull();
    assertDocumentTheme("light");
    assertThemeColor("#9667e0");
  });

  it("normalizes unknown local preference to global", async () => {
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, "unknown" as ThemeModePreference);
    renderWithSettings(createSettings({ theme: { accent: "#9667e0", mode: "dark" } }));

    expect(screen.getByTestId("preference")).toHaveTextContent("global");
    expect(screen.getByTestId("effective-mode")).toHaveTextContent("dark");
    expect(window.localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBeNull();
    assertDocumentTheme("dark");
    assertThemeColor("#9667e0");
  });

  it("updates theme-color when the accent changes", async () => {
    const view = renderWithSettings(createSettings({ theme: { accent: "#9667e0", mode: "dark" } }));

    assertDocumentTheme("dark");
    assertThemeColor("#9667e0");

    view.rerender(
      <SiteSettingsContext.Provider
        value={{
          settings: createSettings({ theme: { accent: "#34A853", mode: "dark" } }),
          isLoading: false,
          refresh: async () => undefined,
        }}
      >
        <ThemeModeProvider>
          <ThemeProbe />
        </ThemeModeProvider>
      </SiteSettingsContext.Provider>,
    );

    await waitFor(() => {
      assertThemeColor("#34A853");
    });
  });

  it("uses a route-specific theme color for dashboard routes", async () => {
    window.history.replaceState(null, "", "/dashboard/posts");
    renderWithSettings(createSettings({ theme: { accent: "#9667e0", mode: "dark" } }));

    assertThemeColor("#9667e0");
  });
});
