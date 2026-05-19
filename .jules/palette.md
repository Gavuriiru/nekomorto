## $(date +%Y-%m-%d) - Added ARIA labels to Settings Dashboard Trash Buttons
**Learning:** Found several icon-only action buttons (e.g. Delete/Trash) in the dashboard settings layout missing `aria-label`s, indicating this might be a pattern across internal dashboard components where functionality is prioritized over a11y.
**Action:** Always verify icon-only buttons (`DashboardActionButton` using Lucide icons) have appropriate `aria-label`s, especially in complex list/array configuration forms. Keep them in Portuguese to match the app's language context.

## 2024-05-19 - Added ARIA labels and aria-hidden to Icon-only Buttons
**Learning:** Icon-only action buttons (e.g. `DashboardActionButton` wrapping `lucide-react` icons) are frequently missing `aria-label` attributes and the icons themselves lack `aria-hidden="true"`, causing poor screen reader experience (announcing "button" without context, and potentially reading out the SVG). Additionally, when using Radix UI's `asChild` on these wrappers, the `aria-label` correctly propagates down to the underlying element (like `<Link>`).
**Action:** Always add descriptive `aria-label`s in Portuguese to icon-only buttons, and explicitly add `aria-hidden="true"` to nested `lucide-react` icons. Check for `asChild` usage to ensure labels are placed correctly on the wrapper.
