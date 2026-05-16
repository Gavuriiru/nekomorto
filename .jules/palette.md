## $(date +%Y-%m-%d) - Added ARIA labels to Settings Dashboard Trash Buttons
**Learning:** Found several icon-only action buttons (e.g. Delete/Trash) in the dashboard settings layout missing `aria-label`s, indicating this might be a pattern across internal dashboard components where functionality is prioritized over a11y.
**Action:** Always verify icon-only buttons (`DashboardActionButton` using Lucide icons) have appropriate `aria-label`s, especially in complex list/array configuration forms. Keep them in Portuguese to match the app's language context.
## 2026-05-16 - Added ARIA labels to DashboardSettingsSocialLinksTab Trash Buttons
**Learning:** Found more icon-only action buttons (e.g. `Trash2`) in `DashboardSettingsSocialLinksTab.tsx` missing `aria-label`s. This reinforces the pattern that icon-only `DashboardActionButton`s in the dashboard configuration forms frequently lack accessibility labels.
**Action:** Always verify icon-only buttons have descriptive `aria-label`s and add `aria-hidden="true"` to the nested icons to prevent redundant screen reader announcements.
