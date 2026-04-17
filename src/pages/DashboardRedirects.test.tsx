import DashboardRedirects from "@/pages/DashboardRedirects";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

const LocationProbe = () => {
  const location = useLocation();
  return <div>{`${location.pathname}${location.search}`}</div>;
};

describe("DashboardRedirects", () => {
  it("redireciona a rota legada para Configurações > SEO", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/redirecionamentos"]}>
        <Routes>
          <Route path="/dashboard/redirecionamentos" element={<DashboardRedirects />} />
          <Route path="/dashboard/configuracoes" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("/dashboard/configuracoes?tab=seo")).toBeInTheDocument();
  });
});
