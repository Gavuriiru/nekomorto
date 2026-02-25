import { describe, expect, it } from "vitest";

import { buildPublicSearchSuggestions, parseSearchLimit, parseSearchScope } from "../../server/lib/public-search.js";

describe("public-search", () => {
  const projects = [
    {
      id: "project-1",
      title: "Fate Kaleid",
      synopsis: "Magical girls and cards",
      description: "Descricao longa",
      type: "Anime",
      status: "Em andamento",
      tags: ["acao", "fantasia"],
      views: 1200,
      cover: "/uploads/project-1.jpg",
    },
    {
      id: "project-2",
      title: "Tokyo Record",
      synopsis: "Drama urbano",
      description: "",
      type: "Anime",
      status: "Concluido",
      tags: ["drama"],
      views: 220,
      cover: "/uploads/project-2.jpg",
    },
  ];

  const posts = [
    {
      id: "post-1",
      slug: "fate-noticia",
      title: "Atualizacao Fate",
      excerpt: "Novo capitulo",
      author: "Equipe",
      tags: ["acao"],
      views: 900,
      coverImageUrl: "/uploads/post-1.jpg",
    },
  ];

  it("retorna vazio para query curta", () => {
    const result = buildPublicSearchSuggestions({
      query: "f",
      scope: "all",
      limit: 8,
      projects,
      posts,
    });
    expect(result).toEqual([]);
  });

  it("encontra resultado relevante com typo", () => {
    const result = buildPublicSearchSuggestions({
      query: "faet",
      scope: "all",
      limit: 8,
      projects,
      posts,
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.label.toLowerCase()).toContain("fate");
  });

  it("respeita scope e limite", () => {
    const projectsOnly = buildPublicSearchSuggestions({
      query: "fate",
      scope: "projects",
      limit: 1,
      projects,
      posts,
    });
    expect(projectsOnly).toHaveLength(1);
    expect(projectsOnly[0]?.kind).toBe("project");

    const postsOnly = buildPublicSearchSuggestions({
      query: "fate",
      scope: "posts",
      limit: 10,
      projects,
      posts,
    });
    expect(postsOnly.length).toBeGreaterThan(0);
    expect(postsOnly.every((item) => item.kind === "post")).toBe(true);
  });

  it("normaliza scope e limit invalidos", () => {
    expect(parseSearchScope("PROJECTS")).toBe("projects");
    expect(parseSearchScope("qualquer")).toBe("all");
    expect(parseSearchLimit("999")).toBe(20);
    expect(parseSearchLimit("-1")).toBe(8);
  });
});

