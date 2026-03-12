import { describe, expect, it } from "vitest";

import {
  hasAniListOrganizationChanges,
  mergeAniListOrganizationIntoProject,
} from "../../server/lib/project-anilist-metadata.js";

describe("mergeAniListOrganizationIntoProject", () => {
  it("sobrescreve studio quando AniList devolve estudio de animacao", () => {
    const merged = mergeAniListOrganizationIntoProject(
      {
        id: "project-1",
        studio: "Kadokawa Media House",
        animationStudios: [],
        producers: [],
      },
      {
        studio: "Doga Kobo",
        animationStudios: ["Doga Kobo"],
        producers: ["Kadokawa Media House", "AT-X"],
      },
    );

    expect(merged).toEqual(
      expect.objectContaining({
        studio: "Doga Kobo",
        animationStudios: ["Doga Kobo"],
        producers: ["Kadokawa Media House", "AT-X"],
      }),
    );
    expect(
      hasAniListOrganizationChanges(
        {
          studio: "Kadokawa Media House",
          animationStudios: [],
          producers: [],
        },
        merged,
      ),
    ).toBe(true);
  });

  it("preserva studio atual quando AniList nao devolve estudio de animacao", () => {
    const merged = mergeAniListOrganizationIntoProject(
      {
        id: "project-2",
        studio: "Label manual",
        animationStudios: ["Antigo"],
        producers: ["Antiga produtora"],
      },
      {
        studio: "",
        animationStudios: [],
        producers: ["Kadokawa Media House"],
      },
    );

    expect(merged).toEqual(
      expect.objectContaining({
        studio: "Label manual",
        animationStudios: [],
        producers: ["Kadokawa Media House"],
      }),
    );
  });
});
