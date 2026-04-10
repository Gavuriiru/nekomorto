# ERROR_HANDLING Fix Plan

## Changes

- `server/lib/global-error-handler.js` - added a centralized Express error handler that logs details server-side and returns generic client-safe messages
- `server/index.js` - mounted the global error handler after route registration
- `src/server/global-error-handler.test.ts` - added regression coverage for API and non-API failure responses

## New files

- `server/lib/global-error-handler.js` - centralized error handling middleware
- `src/server/global-error-handler.test.ts` - regression coverage for generic error responses

## Verification goals

- [x] A global error handler catches unhandled exceptions
- [x] API responses contain only generic error messages
- [x] Full error details are logged server-side only
- [x] No stack traces or file paths are returned in tested API responses
- [x] Error-handler regression tests pass

## Manual verification (for the human)

- Trigger a failing API route in a non-test environment and confirm the client sees only `{"error":"Something went wrong"}` while the server log keeps the details.

