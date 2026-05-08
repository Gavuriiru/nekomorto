## $(date +%Y-%m-%d) - Added ARIA labels to Settings Dashboard Trash Buttons
**Learning:** Found several icon-only action buttons (e.g. Delete/Trash) in the dashboard settings layout missing `aria-label`s, indicating this might be a pattern across internal dashboard components where functionality is prioritized over a11y.
**Action:** Always verify icon-only buttons (`DashboardActionButton` using Lucide icons) have appropriate `aria-label`s, especially in complex list/array configuration forms. Keep them in Portuguese to match the app's language context.

## $(date +%Y-%m-%d) - Replace Text with Accessible Icons
**Learning:** When improving UI actions (like remove buttons), replacing plain text characters (like "x") with standard icons (like `X` from `lucide-react`) enhances both visual consistency and accessibility when paired with proper focus rings (`focus:outline-none focus:ring-2 focus:ring-ring`), and interactive color states.
**Action:** Always prefer `lucide-react` icons over text characters for action buttons in this codebase, and ensure interactive states (hover/focus) are clearly defined using Tailwind classes.
