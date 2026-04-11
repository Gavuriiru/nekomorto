import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { ScrollToTop } from "@/App";

const NavigationProbe = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div>
      <div data-testid="pathname">{location.pathname}</div>
      <div data-testid="search">{location.search}</div>
      <button
        type="button"
        onClick={() => navigate("/volume", { state: { preserveScroll: true } })}
      >
        Abrir volume
      </button>
      <button
        type="button"
        onClick={() =>
          navigate(
            {
              pathname: location.pathname,
              search: "?page=2",
            },
            {
              replace: true,
              state: { preserveScroll: true },
            },
          )
        }
      >
        Sincronizar pagina
      </button>
      <button type="button" onClick={() => navigate("/capitulo")}>
        Abrir capitulo
      </button>
    </div>
  );
};

describe("ScrollToTop", () => {
  beforeEach(() => {
    vi.stubGlobal("scrollTo", vi.fn());
  });

  it("preserva o scroll na navegacao de volume e volta a rolar em navegacao normal", async () => {
    render(
      <MemoryRouter initialEntries={["/inicial"]}>
        <ScrollToTop />
        <Routes>
          <Route path="*" element={<NavigationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    const scrollToMock = vi.mocked(window.scrollTo);
    expect(scrollToMock).toHaveBeenCalledTimes(1);
    scrollToMock.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Abrir volume" }));
    await waitFor(() => {
      expect(screen.getByTestId("pathname")).toHaveTextContent("/volume");
    });
    expect(scrollToMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Abrir capitulo" }));
    await waitFor(() => {
      expect(screen.getByTestId("pathname")).toHaveTextContent("/capitulo");
    });
    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
  });

  it("preserva o scroll em replace in-place de query quando preserveScroll esta no state", async () => {
    render(
      <MemoryRouter initialEntries={["/leitura"]}>
        <ScrollToTop />
        <Routes>
          <Route path="*" element={<NavigationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    const scrollToMock = vi.mocked(window.scrollTo);
    expect(scrollToMock).toHaveBeenCalledTimes(1);
    scrollToMock.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Sincronizar pagina" }));
    await waitFor(() => {
      expect(screen.getByTestId("pathname")).toHaveTextContent("/leitura");
      expect(screen.getByTestId("search")).toHaveTextContent("?page=2");
    });
    expect(scrollToMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Abrir capitulo" }));
    await waitFor(() => {
      expect(screen.getByTestId("pathname")).toHaveTextContent("/capitulo");
    });
    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
  });

  it("centraliza alvos que pedem scroll no meio da tela ao navegar por hash", async () => {
    const scrollIntoViewMock = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });

    try {
      render(
        <MemoryRouter initialEntries={["/doacoes#pix-doacoes"]}>
          <ScrollToTop />
          <Routes>
            <Route
              path="*"
              element={<div id="pix-doacoes" data-scroll-block="center" />}
            />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
      });
    } finally {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: originalScrollIntoView,
      });
    }
  });
});
