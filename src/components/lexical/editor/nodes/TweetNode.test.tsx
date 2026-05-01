import type { ReactNode } from "react";

import { cleanup, render, waitFor } from "@testing-library/react";
import { createEditor } from "lexical";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

const useThemeModeMock = vi.hoisted(() => vi.fn());

vi.mock("@lexical/react/LexicalBlockWithAlignableContents", () => ({
  BlockWithAlignableContents: ({ children }: { children: ReactNode }) => (
    <div data-testid="tweet-block">{children}</div>
  ),
}));

vi.mock("@/hooks/use-theme-mode", () => ({
  useThemeMode: () => useThemeModeMock(),
}));

import { TweetNode } from "@/components/lexical/editor/nodes/TweetNode";

const WIDGET_SCRIPT_URL = "https://platform.twitter.com/widgets.js";

const createThemeState = (effectiveMode: "light" | "dark" = "dark") => ({
  globalMode: effectiveMode,
  effectiveMode,
  preference: "global",
  isOverridden: false,
  setPreference: vi.fn(),
});

type CreateTweetMock = ReturnType<typeof vi.fn>;
type TwitterWindow = Window &
  typeof globalThis & {
    twttr?: {
      widgets: {
        createTweet: CreateTweetMock;
      };
    };
  };

let editorCount = 0;

const decorateTweetNode = (tweetID = "1234567890") => {
  const editor = createEditor({
    namespace: `TweetNodeTest${editorCount++}`,
    nodes: [TweetNode],
    onError: (error) => {
      throw error;
    },
  });

  let decoratedElement: ReturnType<TweetNode["decorate"]> | null = null;

  editor.update(() => {
    const node = new TweetNode(tweetID);
    decoratedElement = node.decorate(
      {} as never,
      {
        theme: {
          embedBlock: {
            base: "embed-base",
            focus: "embed-focus",
          },
        },
      } as never,
    );
  });

  if (!decoratedElement) {
    throw new Error("failed_to_decorate_tweet_node");
  }

  return decoratedElement;
};

const createTweetMock = () =>
  vi.fn(
    async (
      _tweetId: string,
      container: HTMLElement,
      options?: { theme?: "light" | "dark" },
    ) => {
      const tweet = document.createElement("blockquote");
      tweet.className = "twitter-tweet-rendered";
      tweet.setAttribute("data-theme", String(options?.theme || ""));
      container.appendChild(tweet);
      return container;
    },
  );

const setTwitterWidgets = (createTweet: CreateTweetMock) => {
  (window as TwitterWindow).twttr = {
    widgets: {
      createTweet,
    },
  };
};

describe("TweetNode", () => {
  beforeEach(() => {
    consoleWarnSpy.mockClear();
    useThemeModeMock.mockReset();
    useThemeModeMock.mockReturnValue(createThemeState("dark"));
    delete (window as TwitterWindow).twttr;
    document
      .querySelectorAll(`script[src="${WIDGET_SCRIPT_URL}"]`)
      .forEach((node) => node.remove());
  });

  afterEach(() => {
    cleanup();
    delete (window as TwitterWindow).twttr;
    document
      .querySelectorAll(`script[src="${WIDGET_SCRIPT_URL}"]`)
      .forEach((node) => node.remove());
  });

  it("renderiza o wrapper dedicado do tweet para clipping do embed", async () => {
    const widgetMock = createTweetMock();
    setTwitterWidgets(widgetMock);
    const decoratedElement = decorateTweetNode();
    const { container } = render(decoratedElement);

    expect(container.querySelector(".lexical-tweet")).toBeTruthy();
    expect(container.querySelector(".lexical-tweet__target")).toBeTruthy();
    await waitFor(() => {
      expect(widgetMock).toHaveBeenCalledTimes(1);
    });
  });

  it("passa o tema escuro atual para o widget do tweet", async () => {
    const widgetMock = createTweetMock();
    setTwitterWidgets(widgetMock);

    render(decorateTweetNode());

    await waitFor(() => {
      expect(widgetMock).toHaveBeenCalledWith(
        "1234567890",
        expect.any(HTMLElement),
        { theme: "dark" },
      );
    });
  });

  it("passa o tema claro atual para o widget do tweet", async () => {
    const widgetMock = createTweetMock();
    useThemeModeMock.mockReturnValue(createThemeState("light"));
    setTwitterWidgets(widgetMock);

    render(decorateTweetNode());

    await waitFor(() => {
      expect(widgetMock).toHaveBeenCalledWith(
        "1234567890",
        expect.any(HTMLElement),
        { theme: "light" },
      );
    });
  });

  it("recria o embed quando o tema da pagina muda sem duplicar o conteudo", async () => {
    const widgetMock = createTweetMock();
    let themeState = createThemeState("dark");
    useThemeModeMock.mockImplementation(() => themeState);
    setTwitterWidgets(widgetMock);

    const renderTree = () => (
      <div data-theme-marker={themeState.effectiveMode}>
        {decorateTweetNode()}
      </div>
    );
    const view = render(renderTree());

    await waitFor(() => {
      expect(widgetMock).toHaveBeenCalledTimes(1);
    });
    expect(
      view.container.querySelectorAll(".twitter-tweet-rendered"),
    ).toHaveLength(1);
    expect(
      view.container
        .querySelector(".twitter-tweet-rendered")
        ?.getAttribute("data-theme"),
    ).toBe("dark");

    themeState = createThemeState("light");
    view.rerender(renderTree());

    await waitFor(() => {
      expect(widgetMock).toHaveBeenCalledTimes(2);
    });
    expect(widgetMock).toHaveBeenNthCalledWith(
      1,
      "1234567890",
      expect.any(HTMLElement),
      { theme: "dark" },
    );
    expect(widgetMock).toHaveBeenNthCalledWith(
      2,
      "1234567890",
      expect.any(HTMLElement),
      { theme: "light" },
    );
    await waitFor(() => {
      expect(
        view.container.querySelectorAll(".twitter-tweet-rendered"),
      ).toHaveLength(1);
    });
    expect(
      view.container
        .querySelector(".twitter-tweet-rendered")
        ?.getAttribute("data-theme"),
    ).toBe("light");
  });

  it("mantem o tweet atual visivel enquanto prepara o proximo para o crossfade", async () => {
    let resolveLightTheme: (() => void) | null = null;
    const widgetMock = vi.fn(
      async (
        _tweetId: string,
        container: HTMLElement,
        options?: { theme?: "light" | "dark" },
      ) => {
        const tweet = document.createElement("blockquote");
        tweet.className = "twitter-tweet-rendered";
        tweet.setAttribute("data-theme", String(options?.theme || ""));
        container.appendChild(tweet);

        if (options?.theme === "light") {
          await new Promise<void>((resolve) => {
            resolveLightTheme = resolve;
          });
        }

        return container;
      },
    );
    let themeState = createThemeState("dark");
    useThemeModeMock.mockImplementation(() => themeState);
    setTwitterWidgets(widgetMock);

    const renderTree = () => (
      <div data-theme-marker={themeState.effectiveMode}>
        {decorateTweetNode()}
      </div>
    );
    const view = render(renderTree());

    await waitFor(() => {
      expect(widgetMock).toHaveBeenCalledTimes(1);
    });
    expect(
      view.container.querySelectorAll(".lexical-tweet__stage--active"),
    ).toHaveLength(1);
    expect(view.container.querySelector(".tweet-skeleton")).toBeNull();

    themeState = createThemeState("light");
    view.rerender(renderTree());

    await waitFor(() => {
      expect(widgetMock).toHaveBeenCalledTimes(2);
    });
    expect(
      view.container.querySelectorAll(".lexical-tweet__stage"),
    ).toHaveLength(2);
    expect(
      view.container.querySelectorAll(".lexical-tweet__stage--active"),
    ).toHaveLength(1);
    expect(
      view.container.querySelectorAll(".lexical-tweet__stage--entering"),
    ).toHaveLength(1);
    expect(view.container.querySelector(".tweet-skeleton")).toBeNull();

    const resolveNextLightTheme: (() => void) | null = resolveLightTheme;
    if (!resolveNextLightTheme) {
      throw new Error("expected_light_theme_render_to_wait");
    }
    (resolveNextLightTheme as () => void)();

    await waitFor(() => {
      expect(
        view.container.querySelectorAll(".lexical-tweet__stage--active"),
      ).toHaveLength(1);
    });
    await waitFor(() => {
      expect(
        view.container.querySelector(".lexical-tweet__stage--entering"),
      ).toBeNull();
    });
  });

  it("injeta o script do widget uma unica vez enquanto varios tweets aguardam o carregamento", async () => {
    const widgetMock = createTweetMock();
    const view = render(
      <>
        {decorateTweetNode("tweet-1")}
        {decorateTweetNode("tweet-2")}
      </>,
    );

    const scripts = document.querySelectorAll(
      `script[src="${WIDGET_SCRIPT_URL}"]`,
    );
    expect(scripts).toHaveLength(1);
    expect(widgetMock).not.toHaveBeenCalled();

    setTwitterWidgets(widgetMock);
    scripts[0]?.dispatchEvent(new Event("load"));

    await waitFor(() => {
      expect(widgetMock).toHaveBeenCalledTimes(2);
    });
    expect(
      view.container.querySelectorAll(".twitter-tweet-rendered"),
    ).toHaveLength(2);
  });

  it("reaproveita o script ja presente no DOM quando os widgets ja estao prontos", async () => {
    const widgetMock = createTweetMock();
    const existingScript = document.createElement("script");
    existingScript.src = WIDGET_SCRIPT_URL;
    document.body.appendChild(existingScript);
    setTwitterWidgets(widgetMock);

    render(decorateTweetNode("tweet-existing-script"));

    await waitFor(() => {
      expect(widgetMock).toHaveBeenCalledTimes(1);
    });
    expect(widgetMock).toHaveBeenCalledWith(
      "tweet-existing-script",
      expect.any(HTMLElement),
      { theme: "dark" },
    );
    expect(
      document.querySelectorAll(`script[src="${WIDGET_SCRIPT_URL}"]`),
    ).toHaveLength(1);
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });
});
