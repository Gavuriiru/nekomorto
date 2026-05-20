import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PublicScrollToTop from "@/components/PublicScrollToTop";
import {
  navigatePublicDocument,
  usePublicDocumentLocation,
} from "@/lib/public-document-navigation";

const LocationProbe = ({ initialPath = "/" }: { initialPath?: string }) => {
  const location = usePublicDocumentLocation(initialPath);

  return (
    <div>
      <div data-testid="pathname">{location.pathname}</div>
      <div data-testid="search">{location.search}</div>
      <button type="button" onClick={() => navigatePublicDocument("/faq")}>
        Ir para FAQ
      </button>
      <button
        type="button"
        onClick={() =>
          navigatePublicDocument("/doacoes#pix-doacoes", {
            state: { preserveScroll: false },
          })
        }
      >
        Ir para PIX
      </button>
      <button
        type="button"
        onClick={() =>
          navigatePublicDocument("/sobre", {
            state: { preserveScroll: true },
          })
        }
      >
        Preservar scroll
      </button>
    </div>
  );
};

describe("PublicScrollToTop", () => {
  beforeEach(() => {
    vi.stubGlobal("scrollTo", vi.fn());
    window.history.replaceState(null, "", "/equipe");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("rola para o topo em navegacao publica suave", async () => {
    render(
      <>
        <PublicScrollToTop initialPath="/equipe" />
        <LocationProbe initialPath="/equipe" />
      </>,
    );

    const scrollToMock = vi.mocked(window.scrollTo);
    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
    scrollToMock.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Ir para FAQ" }));

    await waitFor(() => {
      expect(screen.getByTestId("pathname")).toHaveTextContent("/faq");
    });
    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
  });

  it("respeita hash com alvo centralizado", async () => {
    const scrollIntoViewMock = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });

    try {
      render(
        <>
          <PublicScrollToTop initialPath="/doacoes" />
          <div id="pix-doacoes" data-scroll-block="center" />
          <LocationProbe initialPath="/doacoes" />
        </>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Ir para PIX" }));

      await waitFor(() => {
        expect(screen.getByTestId("pathname")).toHaveTextContent("/doacoes");
        expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
      });
    } finally {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: originalScrollIntoView,
      });
    }
  });

  it("preserva o scroll quando preserveScroll esta no history state", async () => {
    render(
      <>
        <PublicScrollToTop initialPath="/equipe" />
        <LocationProbe initialPath="/equipe" />
      </>,
    );

    const scrollToMock = vi.mocked(window.scrollTo);
    scrollToMock.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Preservar scroll" }));

    await waitFor(() => {
      expect(screen.getByTestId("pathname")).toHaveTextContent("/sobre");
    });
    expect(scrollToMock).not.toHaveBeenCalled();
  });
});
