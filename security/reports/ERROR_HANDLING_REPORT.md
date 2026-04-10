# ERROR_HANDLING Security Report

## Status: PASS

## Findings

The audit found that a global Express error handler was missing from the end of route registration. That gap has been remediated.

Files changed/reviewed:

- [server/lib/global-error-handler.js](/d:/dev/nekomorto/server/lib/global-error-handler.js)
- [server/index.js](/d:/dev/nekomorto/server/index.js)

Current handler behavior:

```js
logger(JSON.stringify(buildErrorLogPayload(error, req, statusCode)));
...
if (isApiRequest) {
  return res.status(statusCode).json({ error: "Something went wrong" });
}
return res.status(statusCode).type("text/plain; charset=utf-8").send("Something went wrong");
```

Runtime registration:

```js
registerRootServerRoutes(rootRouteRegistrationDependencies);
app.use(createGlobalErrorHandler());
```

Verification results:

- Unhandled route errors now flow through a single global handler.
- API clients receive only generic messages.
- Structured server-side logs retain stack/message/request metadata.
- Tests passed in [src/server/global-error-handler.test.ts](/d:/dev/nekomorto/src/server/global-error-handler.test.ts).

## What's at risk

Without a global handler, Express can leak stack traces, library names, and file paths or return inconsistent error payloads across routes.

## What's already secure

- Full error details are logged server-side.
- API responses are generic.
- Non-API responses also avoid leaking internals.

## Recommendations

1. Keep the global handler mounted after all routes and middleware.
2. Preserve the generic client message contract for API failures.
3. Add route tests whenever custom errors introduce new status code semantics.
