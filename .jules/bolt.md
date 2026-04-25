## 2025-02-22 - Optimize `new Date().getTime()` in sort
**Learning:** Parsing date strings directly inside array `.sort()` comparators incurs a heavy performance penalty because it causes expensive O(N log N) evaluations of `new Date()`. This is particularly impactful when rendering lists of posts or updates on the server.
**Action:** Always precompute the timestamp during a single O(N) map pass (the Schwartzian transform pattern) before performing the sort.
