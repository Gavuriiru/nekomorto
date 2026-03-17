export const getEpisodeNumberValue = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getEpisodeVolumeIdentity = (value: unknown) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : null;
};

export const getEpisodeVolumeValue = (value: unknown) => {
  const normalized = getEpisodeVolumeIdentity(value);
  return normalized ?? 0;
};

export const EXTRA_TECHNICAL_NUMBER_BASE = 100000;

export const buildEpisodeKey = (number: unknown, volume?: unknown) => {
  const safeNumber = getEpisodeNumberValue(number);
  if (safeNumber === null) {
    return "";
  }
  const normalizedVolume = getEpisodeVolumeIdentity(volume);
  return `${safeNumber}:${normalizedVolume === null ? "none" : normalizedVolume}`;
};

export const resolveNextExtraTechnicalNumber = <
  Episode extends {
    number?: unknown;
    volume?: unknown;
  },
>(
  episodes: Episode[],
  volume?: unknown,
  options?: {
    excludeIndex?: number;
  },
) => {
  const list = Array.isArray(episodes) ? episodes : [];
  const excludeIndex = Number.isFinite(Number(options?.excludeIndex))
    ? Number(options?.excludeIndex)
    : -1;
  const reservedKeys = new Set(
    list
      .map((episode, index) => {
        if (index === excludeIndex) {
          return "";
        }
        return buildEpisodeKey(episode?.number, episode?.volume);
      })
      .filter(Boolean),
  );
  let current = EXTRA_TECHNICAL_NUMBER_BASE;
  while (reservedKeys.has(buildEpisodeKey(current, volume))) {
    current += 1;
  }
  return current;
};

export const resolveNextMainEpisodeNumber = <
  Episode extends {
    number?: unknown;
    volume?: unknown;
    entryKind?: unknown;
  },
>(
  episodes: Episode[],
  options?: {
    excludeIndex?: number;
    volume?: number;
    isExtra?: (episode: Episode) => boolean;
  },
) => {
  const list = Array.isArray(episodes) ? episodes : [];
  const excludeIndex = Number.isFinite(Number(options?.excludeIndex))
    ? Number(options?.excludeIndex)
    : -1;
  const volume = Number.isFinite(Number(options?.volume)) ? Number(options?.volume) : undefined;
  const isExtra =
    typeof options?.isExtra === "function"
      ? options.isExtra
      : (episode: Episode) =>
          String(episode?.entryKind || "")
            .trim()
            .toLowerCase() === "extra";
  const reservedKeys = new Set(
    list
      .map((episode, index) => {
        if (index === excludeIndex || isExtra(episode)) {
          return "";
        }
        return buildEpisodeKey(episode?.number, episode?.volume);
      })
      .filter(Boolean),
  );
  let current = 1;
  while (reservedKeys.has(buildEpisodeKey(current, volume))) {
    current += 1;
  }
  return current;
};

export const findDuplicateEpisodeKey = <
  Episode extends {
    number?: unknown;
    volume?: unknown;
  },
>(
  episodes: Episode[],
) => {
  const seen = new Map<string, number>();
  for (let index = 0; index < episodes.length; index += 1) {
    const episode = episodes[index];
    const key = buildEpisodeKey(episode?.number, episode?.volume);
    if (!key) {
      continue;
    }
    if (seen.has(key)) {
      return {
        key,
        firstIndex: seen.get(key) ?? index,
        secondIndex: index,
      };
    }
    seen.set(key, index);
  }
  return null;
};

export const resolveEpisodeLookup = <
  Episode extends {
    number?: unknown;
    volume?: unknown;
  },
>(
  episodes: Episode[],
  episodeNumber: unknown,
  volume?: unknown,
) => {
  const safeNumber = getEpisodeNumberValue(episodeNumber);
  if (safeNumber === null) {
    return { ok: false as const, code: "invalid_episode_number" as const };
  }

  const safeVolume =
    volume === null || volume === undefined || String(volume).trim() === ""
      ? null
      : getEpisodeVolumeIdentity(volume);

  const matches = (Array.isArray(episodes) ? episodes : [])
    .map((episode, index) => ({ episode, index }))
    .filter(({ episode }) => getEpisodeNumberValue(episode?.number) === safeNumber);

  if (matches.length === 0) {
    return { ok: false as const, code: "not_found" as const };
  }

  if (safeVolume !== null) {
    const exact = matches.find(
      ({ episode }) => getEpisodeVolumeIdentity(episode?.volume) === safeVolume,
    );
    if (!exact) {
      return { ok: false as const, code: "not_found" as const };
    }
    return {
      ok: true as const,
      code: "ok" as const,
      ...exact,
      key: buildEpisodeKey(exact.episode?.number, exact.episode?.volume),
    };
  }

  if (matches.length > 1) {
    return { ok: false as const, code: "volume_required" as const, matches };
  }

  return {
    ok: true as const,
    code: "ok" as const,
    ...matches[0],
    key: buildEpisodeKey(matches[0].episode?.number, matches[0].episode?.volume),
  };
};

export const resolveCanonicalEpisodeRouteTarget = <
  Episode extends {
    number?: unknown;
    volume?: unknown;
  },
>(
  episodes: Episode[],
  episodeNumber: unknown,
  preferredVolumes: unknown[] = [],
  options?: {
    exactPreferredOnly?: boolean;
  },
) => {
  const safeNumber = getEpisodeNumberValue(episodeNumber);
  if (safeNumber === null) {
    return null;
  }

  const normalizedPreferredVolumes = preferredVolumes
    .map((value) => {
      if (value === null || value === undefined || String(value).trim() === "") {
        return null;
      }
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        return null;
      }
      const normalized = Math.floor(parsed);
      return normalized >= 0 ? normalized : null;
    })
    .filter(
      (value, index, values): value is number => value !== null && values.indexOf(value) === index,
    );

  for (const volume of normalizedPreferredVolumes) {
    const exactLookup = resolveEpisodeLookup(episodes, safeNumber, volume);
    if (exactLookup.ok) {
      return exactLookup.episode;
    }
  }

  if (normalizedPreferredVolumes.length > 0 && options?.exactPreferredOnly) {
    return null;
  }

  const fallbackLookup = resolveEpisodeLookup(episodes, safeNumber);
  if (fallbackLookup.ok) {
    return fallbackLookup.episode;
  }

  return null;
};
