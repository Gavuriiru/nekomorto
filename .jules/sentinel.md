## 2026-04-20 - [XSS] Unsanitized KaTeX rendering in ViewerEquationNode

**Vulnerability:** KaTeX string output was rendered using `dangerouslySetInnerHTML` directly without sanitization, which poses an XSS risk.
**Learning:** Even well-known libraries like KaTeX do not inherently guarantee safety against crafted mathml/html content injection when directly injected.
**Prevention:** Sanitize the KaTeX HTML output using `DOMPurify.sanitize` with `{ USE_PROFILES: { html: true, mathMl: true } }` prior to using `dangerouslySetInnerHTML`.
## 2025-04-20 - [SSRF in OG Image Delivery]
**Vulnerability:** Server-Side Request Forgery (SSRF) when proxying external artwork and background assets (`server/lib/project-og-assets.js` and `server/lib/institutional-og.js`) using `fetch()`.
**Learning:** Functions designed to proxy external imagery were directly passing user-supplied strings or configurable external URLs to `fetch()` without strictly parsing via the `URL` constructor or blocking redirects. This could allow an attacker to make the server fetch `file://` (if node-fetch supports it, though built-in fetch might fail, but it's risky) or internal IP address endpoints (`http://169.254.169.254/...`).
**Prevention:** Always parse external proxy targets with the `URL` constructor, enforce `https:` or `http:` protocol, and configure the fetch client to block redirects (e.g., `redirect: 'error'`) to prevent attackers from bypassing initial checks via redirecting to internal hosts.
