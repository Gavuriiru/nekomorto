# SSRF Security Report

## Status: PASS

## Findings

The app has a small number of user-influenced URL fetch surfaces, and the active ones are hardened.

Reviewed surfaces:

- [server/lib/remote-image-import.js](/d:/dev/nekomorto/server/lib/remote-image-import.js) - used by `POST /api/uploads/image-from-url` and project image localization flows
- [server/lib/project-image-localizer.js](/d:/dev/nekomorto/server/lib/project-image-localizer.js) - reuses the hardened remote image importer
- [server/lib/webhooks/validation.js](/d:/dev/nekomorto/server/lib/webhooks/validation.js) and [server/routes/register-integration-routes.js](/d:/dev/nekomorto/server/routes/register-integration-routes.js) - webhook test/send paths are restricted to Discord HTTPS webhook URLs

Current SSRF controls in the importer:

```js
if (target.protocol !== "http:" && target.protocol !== "https:") {
  return toFailureResult("invalid_url", "Only HTTP/HTTPS URLs are allowed.");
}
if (target.username || target.password) {
  return toFailureResult("invalid_url_credentials", "URL credentials are not allowed.");
}
if (isPrivateHost(host)) {
  return toFailureResult("host_not_allowed", "Remote host is not allowed.");
}
const resolvedAddresses = await resolveHostAddresses(host);
if (resolvedAddresses.some((address) => isPrivateHost(address))) {
  return toFailureResult("host_not_allowed", "Remote host is not allowed.");
}
```

Redirect validation is also enforced on every hop:

```js
response = await fetchImpl(parsedCurrent.toString(), {
  method: "GET",
  redirect: "manual",
  signal: controller.signal,
});
```

Webhook URL validation is locked down to Discord:

```js
if (protocol !== "https:") {
  return { ok: false, code: "invalid_webhook_url", reason: "invalid_protocol" };
}
if (!DISCORD_WEBHOOK_HOSTS.has(hostname)) {
  return { ok: false, code: "invalid_webhook_url", reason: "unsupported_host" };
}
```

Verification results:

- HTTP and HTTPS are the only allowed schemes for remote image imports.
- Private IPv4/IPv6, localhost, and credential-bearing URLs are blocked before fetch.
- Redirects are resolved manually and revalidated at each hop.
- Focused SSRF tests passed in [src/server/remote-image-import.test.ts](/d:/dev/nekomorto/src/server/remote-image-import.test.ts) and [src/server/url-safety.test.ts](/d:/dev/nekomorto/src/server/url-safety.test.ts).

## What's at risk

Without these controls, attackers could make the server fetch internal metadata endpoints, loopback/admin services, or private network hosts.

## What's already secure

- The general-purpose remote image import flow is SSRF-hardened.
- Project image localization reuses the same hardened importer.
- Webhook delivery targets are restricted to a known provider/host/path pattern.

## Recommendations

1. Reuse `remote-image-import` validation logic for any future fetch-by-URL feature.
2. Keep webhook providers on an explicit allowlist rather than accepting arbitrary URLs.
3. Re-audit any future server-side fetch of user-managed absolute URLs before exposing it broadly.

