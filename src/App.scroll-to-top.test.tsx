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
      <button
        type="button"
        onClick={() => navigate("/volume", { state: { preserveScroll: true } })}
      >
        Abrir volume
      </button>
      <button type="button" onClick={() => navigate("/capitulo")}>
        Abrir capítulo
      </button>
    </div>
  );
};

describe("ScrollToTop", () => {
  beforeEach(() => {
    vi.stubGlobal("scrollTo", vi.fn());
  });

  it("preserva o scroll na navegação de volume e volta a rolar em navegação normal", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Abrir capítulo" }));
    await waitFor(() => {
      expect(screen.getByTestId("pathname")).toHaveTextContent("/capitulo");
    });
    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
  });
});
