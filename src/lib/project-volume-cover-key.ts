export type VolumeCoverLike = {
  volume?: unknown;
};

export const getVolumeCoverValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const buildVolumeCoverKey = (volume?: unknown) => {
  const safeVolume = getVolumeCoverValue(volume);
  return safeVolume === undefined ? "none" : String(safeVolume);
};

export const findDuplicateVolumeCover = <Cover extends VolumeCoverLike>(covers: Cover[]) => {
  const seen = new Map<string, number>();
  for (let index = 0; index < covers.length; index += 1) {
    const key = buildVolumeCoverKey(covers[index]?.volume);
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

export const findVolumeCoverByVolume = <Cover extends VolumeCoverLike>(
  covers: Cover[] | null | undefined,
  volume?: unknown,
) => {
  const key = buildVolumeCoverKey(volume);
  const list = Array.isArray(covers) ? covers : [];
  return list.find((cover) => buildVolumeCoverKey(cover?.volume) === key) ?? null;
};
