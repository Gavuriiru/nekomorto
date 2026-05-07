## $(date +%Y-%m-%d) - Added ARIA labels to Settings Dashboard Trash Buttons
**Learning:** Found several icon-only action buttons (e.g. Delete/Trash) in the dashboard settings layout missing `aria-label`s, indicating this might be a pattern across internal dashboard components where functionality is prioritized over a11y.
**Action:** Always verify icon-only buttons (`DashboardActionButton` using Lucide icons) have appropriate `aria-label`s, especially in complex list/array configuration forms. Keep them in Portuguese to match the app's language context.
## 2026-05-07 - Added ARIA labels to Icon-Only Delete Buttons in Settings Tabs
**Learning:** Icon-only action buttons (like Trash2) used in mapped lists within the dashboard settings components often lack `aria-label` attributes. This presents a recurring accessibility barrier.
**Action:** When adding or reviewing icon-only buttons in list/array configuration forms, ensure they have a descriptive `aria-label` (in Portuguese) that provides context about the specific item being modified or deleted.
