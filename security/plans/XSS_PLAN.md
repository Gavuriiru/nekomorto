# XSS Fix Plan

## Changes

- `src/components/PostContentEditor.tsx` - sanitized preview HTML with DOMPurify before rendering
- `package.json` - pinned `dompurify` as an exact dependency
- `package-lock.json` - updated lockfile for the DOMPurify addition
- `src/components/PostContentEditor.security.test.tsx` - added regression coverage for script/event-handler stripping

## New files

- `src/components/PostContentEditor.security.test.tsx` - verifies preview HTML is sanitized before render

## Verification goals

- [x] No reviewed `dangerouslySetInnerHTML` sink renders unsanitized user HTML
- [x] The post editor preview now sanitizes HTML with DOMPurify
- [x] Existing safe renderers remain constrained or sanitized
- [x] Focused XSS regression tests pass

## Manual verification (for the human)

- Paste HTML with `<script>` or inline event handlers into any preview-capable editor flow and confirm the preview strips executable content.

