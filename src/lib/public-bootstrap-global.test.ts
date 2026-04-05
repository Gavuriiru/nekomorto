import { describe, expect, it } from "vitest";

import { asPublicBootstrapPayload } from "@/lib/public-bootstrap-global";

describe("public bootstrap global parser", () => {
  it("preserva payloadMode critical-home quando informado", () => {
    const parsed = asPublicBootstrapPayload({
      settings: {},
      pages: {},
      projects: [],
      inProgressItems: [
        {
          projectId: "project-ln",
          projectTitle: "NouKin",
          projectType: "Light Novel",
          number: 3,
          volume: 0,
          progressStage: "traducao",
          completedStages: ["aguardando-raw"],
        },
      ],
      posts: [],
      updates: [],
      tagTranslations: {
        tags: {},
        genres: {},
        staffRoles: {},
      },
      generatedAt: "2026-03-05T00:00:00.000Z",
      payloadMode: "critical-home",
    });

    expect(parsed?.payloadMode).toBe("critical-home");
    expect(parsed?.inProgressItems).toEqual([
      expect.objectContaining({
        projectTitle: "NouKin",
        volume: 0,
      }),
    ]);
  });

  it("normaliza payloadMode invalido para full", () => {
    const parsed = asPublicBootstrapPayload({
      settings: {},
      pages: {},
      projects: [],
      inProgressItems: [],
      posts: [],
      updates: [],
      tagTranslations: {
        tags: {},
        genres: {},
        staffRoles: {},
      },
      generatedAt: "2026-03-05T00:00:00.000Z",
      payloadMode: "invalid-mode",
    });

    expect(parsed?.payloadMode).toBe("full");
  });
});
