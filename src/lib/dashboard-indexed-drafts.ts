export const shiftIndexedRecordAfterRemoval = <TValue>(
  record: Record<number, TValue>,
  removedIndex: number,
) => {
  const next: Record<number, TValue> = {};
  Object.entries(record).forEach(([key, value]) => {
    const index = Number(key);
    if (!Number.isFinite(index) || index === removedIndex) {
      return;
    }
    next[index > removedIndex ? index - 1 : index] = value;
  });
  return next;
};

export const clearIndexedRecordValue = <TValue>(
  record: Record<number, TValue>,
  indexToClear: number,
) => {
  if (!Object.prototype.hasOwnProperty.call(record, indexToClear)) {
    return record;
  }
  const next = { ...record };
  delete next[indexToClear];
  return next;
};
