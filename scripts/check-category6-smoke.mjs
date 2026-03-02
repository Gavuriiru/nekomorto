const args = process.argv.slice(2);
const baseArg = args.find((arg) => arg.startsWith("--base="));
const baseUrl = (baseArg ? baseArg.split("=").slice(1).join("=") : "http://localhost:8080").replace(/\/+$/, "");

const checks = [];

const runRequest = async (path, options = {}, { expectedStatuses = [200], label = path } = {}) => {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, options);
  const ok = expectedStatuses.includes(response.status);
  checks.push({
    path,
    method: String(options.method || "GET").toUpperCase(),
    status: response.status,
    expectedStatuses,
    ok,
  });
  if (!ok) {
    const body = await response.text();
    throw new Error(`Smoke check failed for ${label}: ${response.status} (expected ${expectedStatuses.join(", ")})\n${body}`);
  }
  return response;
};

const assertContract = async () => {
  const response = await runRequest("/api/contracts/v1.json");
  const payload = await response.json();

  if (payload?.version !== "v1") {
    throw new Error(`/api/contracts/v1.json returned unexpected version "${payload?.version}"`);
  }
  if (payload?.capabilities?.project_epub_import !== true) {
    throw new Error("/api/contracts/v1.json must advertise capabilities.project_epub_import=true");
  }
  if (payload?.capabilities?.project_epub_export !== true) {
    throw new Error("/api/contracts/v1.json must advertise capabilities.project_epub_export=true");
  }
  if (!Object.hasOwn(payload || {}, "build")) {
    throw new Error("/api/contracts/v1.json must include build metadata");
  }
  if (!Object.hasOwn(payload?.build || {}, "commitSha")) {
    throw new Error("/api/contracts/v1.json build metadata must include commitSha");
  }
  if (!Object.hasOwn(payload?.build || {}, "builtAt")) {
    throw new Error("/api/contracts/v1.json build metadata must include builtAt");
  }
  const endpointPaths = Array.isArray(payload?.endpoints)
    ? payload.endpoints.map((entry) => String(entry?.path || ""))
    : [];
  if (!endpointPaths.includes("/api/projects/epub/import")) {
    throw new Error("/api/contracts/v1.json must list /api/projects/epub/import");
  }
  if (!endpointPaths.includes("/api/projects/epub/export")) {
    throw new Error("/api/contracts/v1.json must list /api/projects/epub/export");
  }
};

const assertAdminRouteExists = async (path, { body, contentType }) => {
  const response = await runRequest(
    path,
    {
      method: "POST",
      headers: {
        "content-type": contentType,
      },
      body,
    },
    {
      expectedStatuses: [200, 201, 202, 204, 400, 401, 403, 405, 409, 415, 422, 429],
      label: `${path} route existence`,
    },
  );
  if (response.status === 404) {
    throw new Error(`${path} route is missing`);
  }
  if (response.status >= 500) {
    const responseBody = await response.text();
    throw new Error(`${path} returned ${response.status}\n${responseBody}`);
  }
};

const main = async () => {
  await runRequest("/api/health");

  const postsRes = await runRequest("/api/public/posts");
  const postsPayload = await postsRes.json();
  const firstPostSlug = postsPayload?.posts?.[0]?.slug;
  if (firstPostSlug) {
    await runRequest(`/api/public/posts/${encodeURIComponent(firstPostSlug)}`);
  }

  const projectsRes = await runRequest("/api/public/projects");
  const projectsPayload = await projectsRes.json();
  const firstProjectId = projectsPayload?.projects?.[0]?.id;
  if (firstProjectId) {
    await runRequest(`/api/public/projects/${encodeURIComponent(firstProjectId)}`);
  }

  await runRequest("/api/public/updates");
  await assertContract();
  await assertAdminRouteExists("/api/projects/epub/import?defaultStatus=draft", {
    body: new Uint8Array([0x45, 0x50, 0x55, 0x42]),
    contentType: "application/epub+zip",
  });
  await assertAdminRouteExists("/api/projects/epub/export", {
    body: JSON.stringify({}),
    contentType: "application/json",
  });

  console.log(
    JSON.stringify(
      {
        baseUrl,
        ts: new Date().toISOString(),
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
