import {
  aggregatePublicSurfaceSummaries,
  comparePublicSurfaceSummary,
  createAcceptedPublicSurfaceBaseline,
  formatPublicSurfaceComparisonMarkdown,
} from "../../scripts/public-surface-performance-lib.mjs";

describe("public surface performance helpers", () => {
  it("agrega rotas e preserva a ordem canonica da superficie publica", () => {
    const summary = aggregatePublicSurfaceSummaries({
      generatedAt: "2026-04-05T03:10:00.000Z",
      runs: 3,
      routeEntries: [
        {
          key: "projects-desktop",
          label: "Projects desktop",
          url: "http://127.0.0.1:4173/projetos",
          medianCategories: {
            performance: 1,
            accessibility: 1,
            "best-practices": 1,
            seo: 1,
          },
          medianMetrics: {
            "first-contentful-paint": 800,
            "largest-contentful-paint": 1200,
            "total-blocking-time": 0,
            "cumulative-layout-shift": 0,
            "speed-index": 1100,
            "interaction-to-next-paint": 75,
          },
        },
        {
          key: "home-mobile",
          label: "Home mobile",
          url: "http://127.0.0.1:4173/",
          medianCategories: {
            performance: 0.99,
            accessibility: 1,
            "best-practices": 1,
            seo: 1,
          },
          medianMetrics: {
            "first-contentful-paint": 900,
            "largest-contentful-paint": 1400,
            "total-blocking-time": 10,
            "cumulative-layout-shift": 0.01,
            "speed-index": 1300,
            "interaction-to-next-paint": null,
          },
        },
      ],
    });

    expect(summary.routeOrder).toEqual(["home-mobile", "projects-desktop"]);
    expect(summary.routes["home-mobile"]?.medianMetrics?.["speed-index"]).toBe(1300);
    expect(summary.routes["projects-desktop"]?.medianCategories?.performance).toBe(1);
  });

  it("marca a rota como ok quando a execucao atual nao regrediu", () => {
    const currentSummary = aggregatePublicSurfaceSummaries({
      runs: 3,
      routeEntries: [
        {
          key: "home-mobile",
          label: "Home mobile",
          url: "http://127.0.0.1:4173/",
          medianCategories: {
            performance: 1,
            accessibility: 1,
            "best-practices": 1,
            seo: 1,
          },
          medianMetrics: {
            "first-contentful-paint": 900,
            "largest-contentful-paint": 1800,
            "total-blocking-time": 20,
            "cumulative-layout-shift": 0.01,
            "speed-index": 1500,
            "interaction-to-next-paint": 120,
          },
        },
      ],
    });
    const baseline = createAcceptedPublicSurfaceBaseline({
      summary: aggregatePublicSurfaceSummaries({
        runs: 3,
        routeEntries: [
          {
            key: "home-mobile",
            label: "Home mobile",
            url: "http://127.0.0.1:4173/",
            medianCategories: {
              performance: 0.98,
              accessibility: 1,
              "best-practices": 1,
              seo: 1,
            },
            medianMetrics: {
              "first-contentful-paint": 950,
              "largest-contentful-paint": 1900,
              "total-blocking-time": 30,
              "cumulative-layout-shift": 0.01,
              "speed-index": 1600,
              "interaction-to-next-paint": 140,
            },
          },
        ],
      }),
      acceptedAt: "2026-04-05T03:20:00.000Z",
    });

    const comparison = comparePublicSurfaceSummary({
      baseline,
      summary: currentSummary,
    });

    expect(comparison.hasRegression).toBe(false);
    expect(comparison.routes["home-mobile"]?.status).toBe("ok");
    expect(comparison.routes["home-mobile"]?.warnings).toHaveLength(0);
  });

  it("gera avisos quando performance, lcp, tbt e cls pioram acima do limite", () => {
    const baseline = createAcceptedPublicSurfaceBaseline({
      summary: aggregatePublicSurfaceSummaries({
        runs: 3,
        routeEntries: [
          {
            key: "projects-mobile",
            label: "Projects mobile",
            url: "http://127.0.0.1:4173/projetos",
            medianCategories: {
              performance: 0.98,
              accessibility: 1,
              "best-practices": 1,
              seo: 1,
            },
            medianMetrics: {
              "first-contentful-paint": 1000,
              "largest-contentful-paint": 1800,
              "total-blocking-time": 20,
              "cumulative-layout-shift": 0.01,
              "speed-index": 1400,
              "interaction-to-next-paint": 120,
            },
          },
        ],
      }),
    });
    const currentSummary = aggregatePublicSurfaceSummaries({
      runs: 3,
      routeEntries: [
        {
          key: "projects-mobile",
          label: "Projects mobile",
          url: "http://127.0.0.1:4173/projetos",
          medianCategories: {
            performance: 0.9,
            accessibility: 1,
            "best-practices": 1,
            seo: 1,
          },
          medianMetrics: {
            "first-contentful-paint": 1100,
            "largest-contentful-paint": 2055,
            "total-blocking-time": 90,
            "cumulative-layout-shift": 0.05,
            "speed-index": 1600,
            "interaction-to-next-paint": 130,
          },
        },
      ],
    });

    const comparison = comparePublicSurfaceSummary({
      baseline,
      summary: currentSummary,
    });

    expect(comparison.hasRegression).toBe(true);
    expect(comparison.routes["projects-mobile"]?.status).toBe("warn");
    expect(comparison.routes["projects-mobile"]?.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "performance-score" }),
        expect.objectContaining({ kind: "largest-contentful-paint" }),
        expect.objectContaining({ kind: "total-blocking-time" }),
        expect.objectContaining({ kind: "cumulative-layout-shift" }),
      ]),
    );
  });

  it("trata baseline ausente como rollout informativo", () => {
    const summary = aggregatePublicSurfaceSummaries({
      runs: 3,
      routeEntries: [
        {
          key: "reader-post-mobile",
          label: "Reader post mobile",
          url: "http://127.0.0.1:4173/postagem/post-teste",
          medianCategories: {
            performance: 0.99,
            accessibility: 1,
            "best-practices": 1,
            seo: 1,
          },
          medianMetrics: {
            "first-contentful-paint": 900,
            "largest-contentful-paint": 1900,
            "total-blocking-time": 0,
            "cumulative-layout-shift": 0,
            "speed-index": 1200,
            "interaction-to-next-paint": null,
          },
        },
      ],
    });

    const comparison = comparePublicSurfaceSummary({
      baseline: {
        schemaVersion: 1,
        acceptedAt: null,
        routeOrder: [],
        routes: {},
      },
      summary,
    });

    expect(comparison.hasRegression).toBe(false);
    expect(comparison.routes["reader-post-mobile"]?.status).toBe("missing-baseline");
  });

  it("formata um relatorio markdown legivel", () => {
    const comparison = comparePublicSurfaceSummary({
      baseline: {
        schemaVersion: 1,
        acceptedAt: null,
        routeOrder: [],
        routes: {},
      },
      summary: aggregatePublicSurfaceSummaries({
        runs: 3,
        routeEntries: [
          {
            key: "home-mobile",
            label: "Home mobile",
            url: "http://127.0.0.1:4173/",
            medianCategories: {
              performance: 1,
              accessibility: 1,
              "best-practices": 1,
              seo: 1,
            },
            medianMetrics: {
              "first-contentful-paint": 900,
              "largest-contentful-paint": 1800,
              "total-blocking-time": 0,
              "cumulative-layout-shift": 0,
              "speed-index": 1200,
              "interaction-to-next-paint": null,
            },
          },
        ],
      }),
    });

    const markdown = formatPublicSurfaceComparisonMarkdown(comparison);

    expect(markdown).toContain("Public Surface Performance Comparison");
    expect(markdown).toContain("## Home mobile");
    expect(markdown).toContain("Baseline ainda não foi aceito");
  });
});
