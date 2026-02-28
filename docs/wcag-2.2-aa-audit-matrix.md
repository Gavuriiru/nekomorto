# WCAG 2.2 AA Audit Matrix

This matrix documents the accessibility work delivered in Categoria 5 and how it is verified.

## Scope

- Public shell and public metadata flows
- Dashboard shell and dashboard editors
- Keyboard reordering flows that previously depended only on drag-and-drop
- Critical image alt-text validation in posts, projects, public pages, and site settings

## Criteria Coverage

| WCAG | Area | Coverage | Evidence |
| --- | --- | --- | --- |
| 1.1.1 Non-text Content | Critical public images and share images | Required alt text for post covers, project media, episode covers, page share images, and default share image | Application validation in dashboard forms, metadata propagation tests, manual verification in public pages |
| 1.3.1 Info and Relationships | Navigation landmarks and structural semantics | Skip links, `main`, dashboard navigation targets, semantic native buttons replacing pseudo-buttons | `src/components/SkipLinks.a11y.test.tsx`, manual keyboard audit |
| 1.4.3 Contrast (Minimum) | Shared theme tokens | Dark and light tokens validated against required text pairs | `src/test/theme-tokens.contrast.test.ts` |
| 1.4.11 Non-text Contrast | Focus rings and sidebar focus indicators | `ring` and `sidebar-ring` validated against page backgrounds | `src/test/theme-tokens.contrast.test.ts` |
| 2.1.1 Keyboard | Public and dashboard interactions | Keyboard skip links, native buttons, keyboard reorder controls for custom sortable surfaces | `src/components/ReorderControls.keyboard.test.tsx`, manual keyboard audit |
| 2.4.3 Focus Order | Shell entry points | Skip links move focus to stable targets in public and dashboard shells | Manual verification on public shell and dashboard shell |
| 2.4.7 Focus Visible | Interactive controls | Native buttons and ring tokens provide visible focus states | Manual verification with keyboard-only navigation |
| 2.4.11 Focus Not Obscured | Shell jump targets | Focus targets use `scroll-margin-top` to avoid sticky header overlap | Manual verification on public and dashboard shells |
| 2.5.7 Dragging Movements | Sortable lists | All critical reorder flows keep drag support but now expose explicit move up/down controls | `src/components/ReorderControls.keyboard.test.tsx`, page-level manual verification |
| 3.3.1 Error Identification | Critical image alt fields | Inline errors with `role="alert"` and destructive save-blocking | Existing dashboard validation tests plus manual verification |
| 3.3.2 Labels or Instructions | Alt text inputs and icon-only controls | Added labels, `aria-label`, and helper copy on required fields | Manual verification and targeted component tests |

## Automated Test Coverage

- `npm run test:a11y` runs:
- `src/components/SkipLinks.a11y.test.tsx`
- `src/components/ReorderControls.keyboard.test.tsx`
- `src/hooks/use-page-meta.a11y.test.tsx`
- `src/test/theme-tokens.contrast.test.ts`

## Manual Verification Checklist

- Tab from the first focusable element on public pages reaches the skip link and moves focus to public content.
- Tab from the first focusable element in the dashboard reaches the skip links and moves focus to navigation and main content.
- Reordering in dashboard pages, project editor, settings, users, and post tags is possible without drag.
- Icon-only controls in custom editor surfaces expose accessible names and visible focus.
- Saving with missing alt text on critical images is blocked and announces an inline error.
