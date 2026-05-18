import { Badge } from "@/components/ui/badge";
import { defaultSettings, mergeSettings, SiteSettingsContext } from "@/hooks/site-settings-context";
import {
  THEME_MODE_GLOBAL_STATE_KEY,
  THEME_MODE_PRESERVE_MOTION_ATTRIBUTE,
  THEME_MODE_STORAGE_KEY,
  type ThemeModePreference,
} from "@/hooks/theme-mode-context";
import TweetComponent from "@/components/lexical/editor/nodes/TweetComponent";
import { ThemeModeProvider } from "@/hooks/theme-mode-provider";
import { useThemeMode } from "@/hooks/use-theme-mode";
import { resolveThemeColor } from "@/lib/theme-color";
import type { SiteSettings } from "@/types/site-settings";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@lexical/react/LexicalBlockWithAlignableContents", () => ({
  BlockWithAlignableContents: ({ children }: { children: ReactNode }) => (
    <div data-testid="tweet-block">{children}</div>
  ),
}));

const createSettings = (override: Partial<SiteSettings> = {}) =>
  mergeSettings(defaultSettings, override);
const THEME_TRANSITION_STYLE_SELECTOR = 'style[data-theme-mode-disable-transitions="true"]';

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

const NamedThemeProbe = ({ name }: { name: string }) => {
  const { effectiveMode, preference, setPreference } = useThemeMode();

  return (
    <section data-testid={`theme-probe-${name}`}>
      <p data-testid={`effective-mode-${name}`}>{effectiveMode}</p>
      <p data-testid={`preference-${name}`}>{preference}</p>
      <button type="button" onClick={() => setPreference("light")}>
        set-light-{name}
      </button>
      <button type="button" onClick={() => setPreference("dark")}>
        set-dark-{name}
      </button>
    </section>
  );
};

const renderWithSettings = (settings: SiteSettings, children: ReactNode = <ThemeProbe />) =>
  render(
    <SiteSettingsContext.Provider
      value={{
        settings,
        isLoading: false,
        refresh: async () => undefined,
      }}
    >
      <ThemeModeProvider>{children}</ThemeModeProvider>
    </SiteSettingsContext.Provider>,
  );

const buildThemeProviderTree = (settings: SiteSettings, children: ReactNode = <ThemeProbe />) => (
  <SiteSettingsContext.Provider
    value={{
      settings,
      isLoading: false,
      refresh: async () => undefined,
    }}
  >
    <ThemeModeProvider>{children}</ThemeModeProvider>
  </SiteSettingsContext.Provider>
);

const assertDocumentTheme = (mode: "light" | "dark") => {
  expect(document.documentElement.dataset.themeMode).toBe(mode);
  expect(document.documentElement.style.colorScheme).toBe(mode);
  expect(document.documentElement.classList.contains("dark")).toBe(mode === "dark");
};

const assertThemeColor = (color: string) => {
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  expect(themeColorMeta?.getAttribute("content")).toBe(resolveThemeColor(color));
};

const mockAnimationFrames = () => {
  let nextHandle = 1;
  let callbacks = new Map<number, FrameRequestCallback>();

  const requestAnimationFrameMock = vi
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((callback: FrameRequestCallback) => {
      const handle = nextHandle++;
      callbacks.set(handle, callback);
      return handle;
    });

  const cancelAnimationFrameMock = vi
    .spyOn(window, "cancelAnimationFrame")
    .mockImplementation((handle: number) => {
      callbacks.delete(handle);
    });

  return {
    flushFrame() {
      const currentCallbacks = [...callbacks.entries()];
      callbacks = new Map<number, FrameRequestCallback>();
      currentCallbacks.forEach(([, callback]) => callback(performance.now()));
    },
    restore() {
      requestAnimationFrameMock.mockRestore();
      cancelAnimationFrameMock.mockRestore();
    },
  };
};

describe("ThemeModeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete (
      window as Window &
        typeof globalThis & {
          [THEME_MODE_GLOBAL_STATE_KEY]?: unknown;
        }
    )[THEME_MODE_GLOBAL_STATE_KEY];
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

  afterEach(() => {
    document.head.querySelector(THEME_TRANSITION_STYLE_SELECTOR)?.remove();
    delete (
      window as Window &
        typeof globalThis & {
          twttr?: unknown;
        }
    ).twttr;
    vi.restoreAllMocks();
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

    await waitFor(() => {
      expect(screen.getByTestId("effective-mode")).toHaveTextContent("dark");
    });
    expect(screen.getByTestId("global-mode")).toHaveTextContent("light");
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

    await waitFor(() => {
      expect(screen.getByTestId("preference")).toHaveTextContent("global");
    });
    expect(screen.getByTestId("effective-mode")).toHaveTextContent("dark");
    expect(window.localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBeNull();
    assertDocumentTheme("dark");
    assertThemeColor("#9667e0");
  });

  it("hydrates without mismatch when a stored preference diverges from the global theme", async () => {
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, "dark");
    const settings = createSettings({ theme: { accent: "#9667e0", mode: "light" } });
    const tree = buildThemeProviderTree(settings);
    const container = document.createElement("div");
    container.innerHTML = renderToString(tree);
    document.body.appendChild(container);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const root = hydrateRoot(container, tree);

    try {
      await waitFor(() => {
        expect(container.querySelector('[data-testid="effective-mode"]')).toHaveTextContent("dark");
      });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        root.unmount();
      });
      consoleErrorSpy.mockRestore();
      container.remove();
    }
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
    expect(document.head.querySelector(THEME_TRANSITION_STYLE_SELECTOR)).toBeNull();
  });

  it("uses the same theme color across routes for the same accent", async () => {
    const routes = ["/", "/projetos", "/postagem/slug-teste", "/dashboard/posts"];

    routes.forEach((route) => {
      window.history.replaceState(null, "", route);
      const view = renderWithSettings(
        createSettings({ theme: { accent: "#9667e0", mode: "dark" } }),
      );
      assertThemeColor("#9667e0");
      view.unmount();
    });
  });

  it("temporarily disables transitions while switching theme mode", async () => {
    const animationFrames = mockAnimationFrames();

    try {
      renderWithSettings(createSettings({ theme: { accent: "#9667e0", mode: "light" } }));
      fireEvent.click(screen.getByRole("button", { name: "set-dark" }));

      const style = document.head.querySelector<HTMLStyleElement>(THEME_TRANSITION_STYLE_SELECTOR);
      expect(style).not.toBeNull();
      expect(style?.textContent).toContain("transition:none !important");
      expect(style?.textContent).toContain(THEME_MODE_PRESERVE_MOTION_ATTRIBUTE);
      expect(style?.textContent).toContain(
        `*:not([${THEME_MODE_PRESERVE_MOTION_ATTRIBUTE}="true"]`,
      );
      assertDocumentTheme("dark");

      animationFrames.flushFrame();
      expect(document.head.querySelector(THEME_TRANSITION_STYLE_SELECTOR)).not.toBeNull();

      animationFrames.flushFrame();
      expect(document.head.querySelector(THEME_TRANSITION_STYLE_SELECTOR)).toBeNull();
    } finally {
      animationFrames.restore();
    }
  });

  it("does not create the temporary transition style when only the accent changes", async () => {
    const view = renderWithSettings(createSettings({ theme: { accent: "#9667e0", mode: "dark" } }));

    expect(document.head.querySelector(THEME_TRANSITION_STYLE_SELECTOR)).toBeNull();

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
    expect(document.head.querySelector(THEME_TRANSITION_STYLE_SELECTOR)).toBeNull();
  });

  it("cleans up temporary theme transition on unmount", async () => {
    const animationFrames = mockAnimationFrames();

    try {
      const view = renderWithSettings(
        createSettings({ theme: { accent: "#9667e0", mode: "light" } }),
      );
      fireEvent.click(screen.getByRole("button", { name: "set-dark" }));

      expect(document.head.querySelector(THEME_TRANSITION_STYLE_SELECTOR)).not.toBeNull();

      view.unmount();

      expect(document.head.querySelector(THEME_TRANSITION_STYLE_SELECTOR)).toBeNull();
    } finally {
      animationFrames.restore();
    }
  });

  it("syncs theme preference across independent roots in the same document", async () => {
    const settings = createSettings({ theme: { accent: "#9667e0", mode: "dark" } });
    const firstRoot = renderWithSettings(settings, <NamedThemeProbe name="first" />);
    const secondRoot = renderWithSettings(settings, <NamedThemeProbe name="second" />);

    expect(within(firstRoot.container).getByTestId("effective-mode-first")).toHaveTextContent(
      "dark",
    );
    expect(within(secondRoot.container).getByTestId("effective-mode-second")).toHaveTextContent(
      "dark",
    );

    fireEvent.click(within(firstRoot.container).getByRole("button", { name: "set-light-first" }));

    await waitFor(() => {
      expect(within(secondRoot.container).getByTestId("effective-mode-second")).toHaveTextContent(
        "light",
      );
    });
    expect(within(secondRoot.container).getByTestId("preference-second")).toHaveTextContent(
      "light",
    );
    assertDocumentTheme("light");
  });

  it("recreates tweet embeds in another root when global theme sync changes", async () => {
    const createTweet = vi.fn(
      async (_tweetId: string, container: HTMLElement, options?: { theme?: "light" | "dark" }) => {
        const tweet = document.createElement("blockquote");
        tweet.className = "twitter-tweet-rendered";
        tweet.setAttribute("data-theme", String(options?.theme || ""));
        container.appendChild(tweet);
        return container;
      },
    );
    (
      window as Window &
        typeof globalThis & {
          twttr?: {
            widgets?: {
              createTweet: typeof createTweet;
            };
          };
        }
    ).twttr = {
      widgets: {
        createTweet,
      },
    };

    const settings = createSettings({ theme: { accent: "#9667e0", mode: "dark" } });
    const controlRoot = renderWithSettings(settings, <NamedThemeProbe name="control" />);
    const tweetRoot = renderWithSettings(
      settings,
      <TweetComponent
        className={{ base: "embed-base", focus: "embed-focus" }}
        format={null}
        nodeKey={"tweet-node"}
        tweetID="1234567890"
      />,
    );

    await waitFor(() => {
      expect(createTweet).toHaveBeenCalledWith("1234567890", expect.any(HTMLElement), {
        theme: "dark",
      });
    });
    expect(
      tweetRoot.container.querySelector(".twitter-tweet-rendered")?.getAttribute("data-theme"),
    ).toBe("dark");

    fireEvent.click(
      within(controlRoot.container).getByRole("button", { name: "set-light-control" }),
    );

    await waitFor(() => {
      expect(createTweet).toHaveBeenCalledWith("1234567890", expect.any(HTMLElement), {
        theme: "light",
      });
    });
    await waitFor(() => {
      expect(
        tweetRoot.container.querySelector(".twitter-tweet-rendered")?.getAttribute("data-theme"),
      ).toBe("light");
    });
    expect(createTweet).toHaveBeenCalledTimes(2);
  });

  it("keeps semantic badges tied to theme tokens in light mode without dark selectors", async () => {
    renderWithSettings(
      createSettings({ theme: { accent: "#9667e0", mode: "light" } }),
      <>
        <ThemeProbe />
        <Badge variant="success" data-testid="theme-badge">
          Sucesso
        </Badge>
      </>,
    );

    const badge = screen.getByTestId("theme-badge");

    await waitFor(() => {
      assertDocumentTheme("light");
    });

    expect(badge).toHaveClass(
      "border-[hsl(var(--badge-success-border))]",
      "bg-[hsl(var(--badge-success-bg))]",
      "text-[hsl(var(--badge-success-fg))]",
    );
    expect(String(badge.className)).not.toContain("dark:");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
