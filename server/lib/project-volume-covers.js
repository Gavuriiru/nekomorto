export const getVolumeCoverValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const buildVolumeCoverKey = (volume) => {
  const safeVolume = getVolumeCoverValue(volume);
  return safeVolume === undefined ? "none" : String(safeVolume);
};

export const findDuplicateVolumeCover = (covers) => {
  const seen = new Map();
  const list = Array.isArray(covers) ? covers : [];
  for (let index = 0; index < list.length; index += 1) {
    const key = buildVolumeCoverKey(list[index]?.volume);
    if (seen.has(key)) {
      return {
        key,
        firstIndex: seen.get(key),
        secondIndex: index,
      };
    }
    seen.set(key, index);
  }
  return null;
};

export const findVolumeCoverByVolume = (covers, volume) => {
  const key = buildVolumeCoverKey(volume);
  const list = Array.isArray(covers) ? covers : [];
  return list.find((cover) => buildVolumeCoverKey(cover?.volume) === key) || null;
};
