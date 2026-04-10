# FILE_UPLOADS Fix Plan

## Changes

- `server/routes/upload/register-upload-metadata-routes.js` - renamed non-slot uploads to UUID-based server filenames
- `server/lib/remote-image-import.js` - renamed non-deterministic remote imports to UUID-based filenames
- `server/lib/uploads-import.js` - renamed generic imported uploads to UUID-based filenames
- `src/server/register-upload-routes.test.ts` - added UUID filename regression coverage for direct uploads
- `src/server/remote-image-import.test.ts` - added UUID filename regression coverage for remote imports

## New files

No new application files were required.

## Verification goals

- [x] File type validation uses magic bytes instead of extensions alone
- [x] Public upload filenames are UUID-based on the server
- [x] Size limits are enforced server-side
- [ ] Production upload delivery is isolated onto a dedicated upload domain or direct object-storage/CDN origin

## Manual verification (for the human)

- Configure production with object storage instead of local upload storage.
- Serve uploads from a dedicated media domain/CDN rather than the app origin.

