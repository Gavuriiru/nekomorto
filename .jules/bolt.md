## 2025-02-28 - React.memo for recursive list rendering
**Learning:** In React, recursive rendering of lists (like nested comment trees) using inline functions (`renderComment`) causes unnecessary re-renders of the entire tree when state changes (like typing in a form input).
**Action:** Extract recursive render functions into standalone components wrapped in `React.memo`, and ensure props like event handlers are memoized with `useCallback`. This significantly reduces React reconciliation overhead.
## 2025-02-28 - Precompute Dates before Sorting
**Learning:** Parsing dates (e.g., `new Date(a.createdAt).getTime()`) inside the comparator function of `Array.prototype.sort()` causes severe performance degradation, especially for large arrays, because the comparator is called O(N log N) times.
**Action:** When sorting by date, precompute the integer timestamps in an initial O(N) pass (e.g. `items.map(item => ({ item, _time: new Date(item.date).getTime() }))`), sort by the precomputed `_time`, and then map back to the original objects.
