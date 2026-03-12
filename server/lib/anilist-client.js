export const ANILIST_API = "https://graphql.anilist.co";

export const ANILIST_MEDIA_IMPORT_QUERY = `
  query ($id: Int) {
    Media(id: $id) {
      id
      title {
        romaji
        english
        native
      }
      description
      episodes
      genres
      format
      status
      countryOfOrigin
      season
      seasonYear
      startDate { year month day }
      endDate { year month day }
      source
      averageScore
      bannerImage
      coverImage { extraLarge large }
      studios {
        edges {
          isMain
          node { id name isAnimationStudio }
        }
      }
      tags {
        name
        rank
        isMediaSpoiler
      }
      trailer {
        id
        site
        thumbnail
      }
      relations {
        edges { relationType }
        nodes {
          id
          title { romaji }
          format
          status
          coverImage { large }
        }
      }
      staff(sort: RELEVANCE, perPage: 10) {
        edges { role }
        nodes { name { full } }
      }
    }
  }
`;

const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;

export const fetchAniListMediaById = async (id, { fetchImpl = fetch } = {}) => {
  const normalizedId = Number(id);
  if (!isPositiveInteger(normalizedId)) {
    return {
      ok: false,
      error: "invalid_id",
      data: null,
      media: null,
      status: 400,
      retryable: false,
    };
  }

  let response;
  try {
    response = await fetchImpl(ANILIST_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: ANILIST_MEDIA_IMPORT_QUERY,
        variables: { id: normalizedId },
      }),
    });
  } catch {
    return {
      ok: false,
      error: "anilist_failed",
      data: null,
      media: null,
      status: null,
      retryable: true,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: "anilist_failed",
      data: null,
      media: null,
      status: response.status,
      retryable: response.status === 429 || response.status >= 500,
    };
  }

  const data = await response.json().catch(() => null);
  return {
    ok: true,
    error: null,
    data,
    media: data?.data?.Media || null,
    status: response.status,
    retryable: false,
  };
};
