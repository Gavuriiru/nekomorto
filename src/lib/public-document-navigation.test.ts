import {
  PUBLIC_DOCUMENT_LOCATION_CHANGE_EVENT,
  canUsePublicAstroClientNavigation,
  navigatePublicDocument,
} from "@/lib/public-document-navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("public-document-navigation", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("usa navegacao client-side entre / e /projetos", () => {
    window.history.replaceState({ from: "home" }, "", "/");
    const listener = vi.fn();
    window.addEventListener(PUBLIC_DOCUMENT_LOCATION_CHANGE_EVENT, listener);

    navigatePublicDocument("/projetos");

    expect(window.location.pathname).toBe("/projetos");
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(PUBLIC_DOCUMENT_LOCATION_CHANGE_EVENT, listener);
  });

  it("explicita quais pares podem usar navegacao client-side", () => {
    expect(canUsePublicAstroClientNavigation({ currentPath: "/", targetPath: "/projetos" })).toBe(
      true,
    );
    expect(
      canUsePublicAstroClientNavigation({
        currentPath: "/projetos",
        targetPath: "/projeto/slug-teste",
      }),
    ).toBe(true);
    expect(
      canUsePublicAstroClientNavigation({
        currentPath: "/projeto/slug-teste",
        targetPath: "/",
      }),
    ).toBe(true);
    expect(
      canUsePublicAstroClientNavigation({
        currentPath: "/equipe",
        targetPath: "/projeto/slug-teste",
      }),
    ).toBe(true);
    expect(
      canUsePublicAstroClientNavigation({
        currentPath: "/faq",
        targetPath: "/login",
      }),
    ).toBe(true);
    expect(
      canUsePublicAstroClientNavigation({
        currentPath: "/projetos",
        targetPath: "/projeto/slug-teste/leitura/capitulo-1",
      }),
    ).toBe(false);
  });
});
