const args = process.argv.slice(2);

const getArgValue = (name) => {
  const item = args.find((entry) => entry.startsWith(`${name}=`));
  return item ? item.slice(name.length + 1) : "";
};

const baseUrl = (getArgValue("--base") || "http://localhost:8080").replace(/\/+$/, "");
const timeoutMs = Number.parseInt(getArgValue("--timeout-ms") || "10000", 10);

if (!baseUrl) {
  console.error("--base is required");
  process.exit(1);
}

const withTimeout = async (resource, options = {}) => {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(resource, {
      ...options,
      signal: controller.signal,
      headers: {
        accept: "application/json, application/xml, application/rss+xml, text/xml;q=0.9, */*;q=0.8",
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const assertJsonEndpoint = async (path, assertPayload) => {
  const response = await withTimeout(`${baseUrl}${path}`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${path} returned ${response.status}: ${body}`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(`${path} expected JSON content-type, got "${contentType}"`);
  }
  const payload = await response.json();
  assertPayload(payload);
  return { path, status: response.status, contentType };
};

const assertXmlEndpoint = async (path, { expectedContentTypePart, expectedBodySnippet }) => {
  const response = await withTimeout(`${baseUrl}${path}`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${path} returned ${response.status}: ${body}`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes(expectedContentTypePart)) {
    throw new Error(`${path} expected content-type containing "${expectedContentTypePart}", got "${contentType}"`);
  }
  const body = await response.text();
  if (!body.includes(expectedBodySnippet)) {
    throw new Error(`${path} response body does not include "${expectedBodySnippet}"`);
  }
  return { path, status: response.status, contentType };
};

const assertManifestEndpoint = async (path) => {
  const response = await withTimeout(`${baseUrl}${path}`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${path} returned ${response.status}: ${body}`);
  }
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("json") && !contentType.includes("manifest")) {
    throw new Error(`${path} expected manifest/json content-type, got "${contentType}"`);
  }
  const body = await response.text();
  if (/^\s*<!doctype html>/i.test(body)) {
    throw new Error(`${path} returned HTML instead of manifest JSON`);
  }
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error(`${path} response is not valid JSON`);
  }
  if (String(payload?.id || "").trim() !== "/") {
    throw new Error(`${path} must include id='/'`);
  }
  if (!Array.isArray(payload?.icons) || payload.icons.length === 0) {
    throw new Error(`${path} must include icons array`);
  }
  if (!Array.isArray(payload?.screenshots) || payload.screenshots.length === 0) {
    throw new Error(`${path} must include screenshots array`);
  }
  return { path, status: response.status, contentType };
};

const assertServiceWorkerEndpoint = async (path) => {
  const response = await withTimeout(`${baseUrl}${path}`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${path} returned ${response.status}: ${body}`);
  }
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (
    !contentType.includes("javascript") &&
    !contentType.includes("ecmascript") &&
    !contentType.includes("text/plain")
  ) {
    throw new Error(`${path} expected javascript content-type, got "${contentType}"`);
  }
  const body = await response.text();
  if (/^\s*<!doctype html>/i.test(body)) {
    throw new Error(`${path} returned HTML instead of service worker JavaScript`);
  }
  const workboxMatch = body.match(/workbox-[A-Za-z0-9_-]+\.js/);
  const workboxScriptPath = workboxMatch ? `/${workboxMatch[0]}` : "";
  return { path, status: response.status, contentType, workboxScriptPath };
};

const main = async () => {
  const checks = [];

  checks.push(
    await assertJsonEndpoint("/api/health/live", (payload) => {
      if (payload?.ok !== true) {
        throw new Error("/api/health/live payload.ok must be true");
      }
      if (payload?.status !== "ok") {
        throw new Error(`/api/health/live status expected "ok", got "${payload?.status}"`);
      }
    }),
  );

  checks.push(
    await assertJsonEndpoint("/api/health/ready", (payload) => {
      const status = payload?.status;
      if (!["ok", "degraded", "fail"].includes(status)) {
        throw new Error(`/api/health/ready status invalid: "${status}"`);
      }
      if (!Array.isArray(payload?.checks)) {
        throw new Error("/api/health/ready checks must be an array");
      }
    }),
  );

  checks.push(
    await assertJsonEndpoint("/api/health", (payload) => {
      if (!Object.hasOwn(payload || {}, "dataSource")) {
        throw new Error("/api/health must include dataSource");
      }
      if (!Object.hasOwn(payload || {}, "maintenanceMode")) {
        throw new Error("/api/health must include maintenanceMode");
      }
      if (!Array.isArray(payload?.checks)) {
        throw new Error("/api/health must include checks array");
      }
    }),
  );

  checks.push(
    await assertXmlEndpoint("/sitemap.xml", {
      expectedContentTypePart: "xml",
      expectedBodySnippet: "<urlset",
    }),
  );
  checks.push(
    await assertXmlEndpoint("/api/public/sitemap.xml", {
      expectedContentTypePart: "xml",
      expectedBodySnippet: "<urlset",
    }),
  );

  checks.push(
    await assertXmlEndpoint("/rss/posts.xml", {
      expectedContentTypePart: "xml",
      expectedBodySnippet: "<rss",
    }),
  );
  checks.push(
    await assertXmlEndpoint("/rss/lancamentos.xml", {
      expectedContentTypePart: "xml",
      expectedBodySnippet: "<rss",
    }),
  );
  checks.push(
    await assertXmlEndpoint("/api/public/rss.xml?feed=posts", {
      expectedContentTypePart: "xml",
      expectedBodySnippet: "<rss",
    }),
  );
  checks.push(
    await assertXmlEndpoint("/api/public/rss.xml?feed=lancamentos", {
      expectedContentTypePart: "xml",
      expectedBodySnippet: "<rss",
    }),
  );

  checks.push(await assertManifestEndpoint("/manifest.webmanifest"));
  const serviceWorkerCheck = await assertServiceWorkerEndpoint("/sw.js");
  checks.push({
    path: serviceWorkerCheck.path,
    status: serviceWorkerCheck.status,
    contentType: serviceWorkerCheck.contentType,
  });

  if (serviceWorkerCheck.workboxScriptPath) {
    const workboxResponse = await withTimeout(`${baseUrl}${serviceWorkerCheck.workboxScriptPath}`);
    if (!workboxResponse.ok) {
      const body = await workboxResponse.text();
      throw new Error(
        `${serviceWorkerCheck.workboxScriptPath} returned ${workboxResponse.status}: ${body}`,
      );
    }
    const workboxContentType = String(workboxResponse.headers.get("content-type") || "").toLowerCase();
    if (
      !workboxContentType.includes("javascript") &&
      !workboxContentType.includes("ecmascript") &&
      !workboxContentType.includes("text/plain")
    ) {
      throw new Error(
        `${serviceWorkerCheck.workboxScriptPath} expected javascript content-type, got "${workboxContentType}"`,
      );
    }
    checks.push({
      path: serviceWorkerCheck.workboxScriptPath,
      status: workboxResponse.status,
      contentType: workboxContentType,
    });
  }

  console.log(
    JSON.stringify(
      {
        baseUrl,
        checks,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
