## 2026-04-20 - [XSS] Unsanitized KaTeX rendering in ViewerEquationNode

**Vulnerability:** KaTeX string output was rendered using `dangerouslySetInnerHTML` directly without sanitization, which poses an XSS risk.
**Learning:** Even well-known libraries like KaTeX do not inherently guarantee safety against crafted mathml/html content injection when directly injected.
**Prevention:** Sanitize the KaTeX HTML output using `DOMPurify.sanitize` with `{ USE_PROFILES: { html: true, mathMl: true } }` prior to using `dangerouslySetInnerHTML`.
