import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import PublicLink from "@/components/PublicLink";

describe("PublicLink", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("intercepta clique simples entre / e /projetos", () => {
    window.history.replaceState(null, "", "/");

    render(<PublicLink href="/projetos">Projetos</PublicLink>);

    fireEvent.click(screen.getByRole("link", { name: "Projetos" }));

    expect(window.location.pathname).toBe("/projetos");
  });

  it("nao intercepta clique com modificador", () => {
    window.history.replaceState(null, "", "/");

    render(<PublicLink href="/projetos">Projetos</PublicLink>);

    fireEvent.click(screen.getByRole("link", { name: "Projetos" }), { ctrlKey: true });

    expect(window.location.pathname).toBe("/");
  });
});
