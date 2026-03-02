export const getEpisodeNumberValue = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getEpisodeVolumeValue = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const buildEpisodeKey = (number: unknown, volume?: unknown) => {
  const safeNumber = getEpisodeNumberValue(number);
  if (safeNumber === null) {
    return "";
  }
  return `${safeNumber}:${getEpisodeVolumeValue(volume)}`;
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
