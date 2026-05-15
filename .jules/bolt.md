## 2025-05-15 - Optimize string sorting with Intl.Collator and Schwartzian Transform
**Learning:** String.prototype.localeCompare is slow for sorting large arrays in this codebase as it regenerates locale rules on every call. Pre-initializing an Intl.Collator and mapping values ahead of time drastically reduces comparison overhead.
**Action:** Whenever sorting arrays by string properties, use a Schwartzian transform pattern coupled with new Intl.Collator() to minimize evaluation cost inside the comparator function.
