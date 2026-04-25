## $(date +%Y-%m-%d) - Added ARIA labels to Settings Dashboard Trash Buttons
**Learning:** Found several icon-only action buttons (e.g. Delete/Trash) in the dashboard settings layout missing `aria-label`s, indicating this might be a pattern across internal dashboard components where functionality is prioritized over a11y.
**Action:** Always verify icon-only buttons (`DashboardActionButton` using Lucide icons) have appropriate `aria-label`s, especially in complex list/array configuration forms. Keep them in Portuguese to match the app's language context.
