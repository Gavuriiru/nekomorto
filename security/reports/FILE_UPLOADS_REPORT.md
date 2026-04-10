# FILE_UPLOADS Security Report

## Status: MEDIUM

## Findings

The upload pipeline is materially hardened, but production delivery is still designed around same-origin `/uploads/...` proxying, so this category is not a full pass yet.

Reviewed files:

- [server/routes/upload/register-upload-metadata-routes.js](/d:/dev/nekomorto/server/routes/upload/register-upload-metadata-routes.js)
- [server/routes/upload/register-upload-management-routes.js](/d:/dev/nekomorto/server/routes/upload/register-upload-management-routes.js)
- [server/lib/upload-runtime-helpers.js](/d:/dev/nekomorto/server/lib/upload-runtime-helpers.js)
- [server/lib/remote-image-import.js](/d:/dev/nekomorto/server/lib/remote-image-import.js)
- [server/lib/uploads-import.js](/d:/dev/nekomorto/server/lib/uploads-import.js)
- [server/lib/uploads-delivery.js](/d:/dev/nekomorto/server/lib/uploads-delivery.js)
- [server/lib/uploads-object-storage.js](/d:/dev/nekomorto/server/lib/uploads-object-storage.js)
- [.env.example](/d:/dev/nekomorto/.env.example)

Secure controls present:

- Magic-byte validation exists in [server/lib/upload-runtime-helpers.js](/d:/dev/nekomorto/server/lib/upload-runtime-helpers.js)
- SVG uploads are sanitized
- Server-side size limits are enforced
- Public upload names were remediated to UUID-based filenames for direct uploads, URL imports, and generic stored image imports

Remediated filename handling:

```diff
- : `${safeName || "imagem"}-${Date.now()}.${ext}`;
+ : `${crypto.randomUUID()}.${ext}`;
```

```diff
- const fileName = deterministicMode ? `${safeBase}.${ext}` : `${safeBase}-${Date.now()}.${ext}`;
+ const fileName = deterministicMode ? `${safeBase}.${ext}` : `${crypto.randomUUID()}.${ext}`;
```

Remaining gap:

- [`.env.example`](/d:/dev/nekomorto/.env.example) still defaults to:

```env
UPLOAD_STORAGE_DRIVER=local
UPLOAD_STORAGE_DELIVERY=proxy
```

- [server/lib/uploads-delivery.js](/d:/dev/nekomorto/server/lib/uploads-delivery.js) serves local assets directly from the app origin and proxies object-storage assets back through the app origin:

```js
if (provider === "local") {
  return res.sendFile(targetPath);
}
...
response.stream.pipe(res);
```

This means:

- bucket/object-storage support exists
- same-origin proxy delivery remains the default contract
- a dedicated upload domain/CDN/direct object-storage delivery path is not yet enforced

Verification results:

- Magic-byte validation and size limits are present.
- UUID naming regression coverage passed in:
  - [src/server/register-upload-routes.test.ts](/d:/dev/nekomorto/src/server/register-upload-routes.test.ts)
  - [src/server/remote-image-import.test.ts](/d:/dev/nekomorto/src/server/remote-image-import.test.ts)
- Same-origin `/uploads/...` delivery is still present, so the separate-domain/delivery goal remains open.

## What's at risk

Same-origin upload delivery increases the blast radius of cache/content-type mistakes and weakens isolation between application pages and user-managed media.

## What's already secure

- Upload type validation uses bytes, not only extensions.
- Upload size limits are enforced server-side.
- Server-generated public filenames now use UUIDs.
- Object storage support already exists for S3-compatible providers.

## Recommendations

1. Make object storage mandatory in production.
2. Move production media delivery to a dedicated upload domain or direct object-storage/CDN origin instead of app-origin proxying.
3. Keep deterministic filenames limited to tightly scoped internal workflows only.
