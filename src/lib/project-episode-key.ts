export const getEpisodeNumberValue = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getEpisodeVolumeValue = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const EXTRA_TECHNICAL_NUMBER_BASE = 100000;

export const buildEpisodeKey = (number: unknown, volume?: unknown) => {
  const safeNumber = getEpisodeNumberValue(number);
  if (safeNumber === null) {
    return "";
  }
  return `${safeNumber}:${getEpisodeVolumeValue(volume)}`;
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
