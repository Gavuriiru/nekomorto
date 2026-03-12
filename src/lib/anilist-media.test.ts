import { describe, expect, it } from "vitest";

import { deriveAniListMediaOrganization } from "./anilist-media";

describe("deriveAniListMediaOrganization", () => {
  it("separa estudio principal de animacao e produtoras a partir de studios.edges", () => {
    const organization = deriveAniListMediaOrganization({
      studios: {
        edges: [
          {
            isMain: true,
            node: {
              id: 1,
              name: "Doga Kobo",
              isAnimationStudio: true,
            },
          },
          {
            isMain: false,
            node: {
              id: 2,
              name: "Kadokawa Media House",
              isAnimationStudio: false,
            },
          },
          {
            isMain: false,
            node: {
              id: 3,
              name: "AT-X",
              isAnimationStudio: false,
            },
          },
          {
            isMain: false,
            node: {
              id: 4,
              name: "Sony Music Communications",
              isAnimationStudio: false,
            },
          },
          {
            isMain: false,
            node: {
              id: 5,
              name: "KADOKAWA",
              isAnimationStudio: false,
            },
          },
        ],
      },
    });

    expect(organization).toEqual({
      studio: "Doga Kobo",
      animationStudios: ["Doga Kobo"],
      producers: ["Kadokawa Media House", "AT-X", "Sony Music Communications", "KADOKAWA"],
    });
  });

  it("nunca promove uma produtora para o campo studio quando nao existe estudio de animacao", () => {
    const organization = deriveAniListMediaOrganization({
      studios: {
        edges: [
          {
            isMain: true,
            node: {
              id: 10,
              name: "Kadokawa",
              isAnimationStudio: false,
            },
          },
          {
            isMain: false,
            node: {
              id: 11,
              name: "Aniplex",
              isAnimationStudio: false,
            },
          },
        ],
      },
    });

    expect(organization).toEqual({
      studio: "",
      animationStudios: [],
      producers: ["Kadokawa", "Aniplex"],
    });
  });
});
