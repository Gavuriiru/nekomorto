# XSS Security Report

## Status: PASS

## Findings

The audit found one dormant unsafe preview sink in frontend code and remediated it. Other reviewed HTML/rendering paths are currently constrained or sanitized.

Reviewed files:

- [src/components/PostContentEditor.tsx](/d:/dev/nekomorto/src/components/PostContentEditor.tsx)
- [src/components/lexical/viewer-nodes/ViewerEquationNode.tsx](/d:/dev/nekomorto/src/components/lexical/viewer-nodes/ViewerEquationNode.tsx)
- [src/components/ui/chart.tsx](/d:/dev/nekomorto/src/components/ui/chart.tsx)
- [server/lib/url-safety.js](/d:/dev/nekomorto/server/lib/url-safety.js)
- [server/lib/project-epub-import.js](/d:/dev/nekomorto/server/lib/project-epub-import.js)
- [server/lib/project-epub-export.js](/d:/dev/nekomorto/server/lib/project-epub-export.js)

Issue found and fixed:

```diff
- dangerouslySetInnerHTML={{ __html: previewHtml }}
+ const sanitizedPreviewHtml = DOMPurify.sanitize(previewHtml, {
+   USE_PROFILES: { html: true },
+ });
+ dangerouslySetInnerHTML={{ __html: sanitizedPreviewHtml }}
```

Safe/restricted rendering already present elsewhere:

- KaTeX preview rendering uses `trust: false` in [ViewerEquationNode.tsx](/d:/dev/nekomorto/src/components/lexical/viewer-nodes/ViewerEquationNode.tsx)
- Public URL sanitizers block `javascript:`, `data:`, `vbscript:`, `file:`, and `blob:` for links/assets/icons in [server/lib/url-safety.js](/d:/dev/nekomorto/server/lib/url-safety.js)
- EPUB import/export HTML is sanitized with `sanitize-html`
- The chart style sink in [src/components/ui/chart.tsx](/d:/dev/nekomorto/src/components/ui/chart.tsx) is generated from internal chart config, not user-authored HTML content

Verification results:

- DOMPurify is now applied before the dormant preview sink renders HTML.
- Security regression test passed in [src/components/PostContentEditor.security.test.tsx](/d:/dev/nekomorto/src/components/PostContentEditor.security.test.tsx).
- Existing server URL-safety tests remain green in [src/server/url-safety.test.ts](/d:/dev/nekomorto/src/server/url-safety.test.ts).

## What's at risk

Unsanitized HTML rendering can allow account takeover, admin action abuse, session theft, or content defacement through injected scripts and event handlers.

## What's already secure

- The audited preview sink is now sanitized.
- Math rendering uses a non-trusting KaTeX mode.
- URL sanitizers block scriptable protocols.
- EPUB HTML processing uses an allowlist sanitizer.

## Recommendations

1. Keep DOMPurify in front of any future `dangerouslySetInnerHTML` use with user-managed HTML.
2. Treat every new raw HTML sink as a mandatory security review point.
3. Prefer structured editors/viewers over raw HTML transport wherever possible.
