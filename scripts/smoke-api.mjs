const args = process.argv.slice(2);
const baseArg = args.find((arg) => arg.startsWith("--base="));
const baseUrl = (baseArg ? baseArg.split("=").slice(1).join("=") : "http://localhost:8080").replace(/\/+$/, "");

const checks = [];

const runGet = async (path, expectedStatus = 200) => {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, { method: "GET" });
  const ok = response.status === expectedStatus;
  checks.push({
    path,
    status: response.status,
    expectedStatus,
    ok,
  });
  if (!ok) {
    const body = await response.text();
    throw new Error(`Smoke check failed for ${path}: ${response.status} (expected ${expectedStatus})\n${body}`);
  }
  return response;
};

const main = async () => {
  await runGet("/api/health");
  const postsRes = await runGet("/api/public/posts");
  const postsPayload = await postsRes.json();
  const firstPostSlug = postsPayload?.posts?.[0]?.slug;
  if (firstPostSlug) {
    await runGet(`/api/public/posts/${encodeURIComponent(firstPostSlug)}`);
  }

  const projectsRes = await runGet("/api/public/projects");
  const projectsPayload = await projectsRes.json();
  const firstProjectId = projectsPayload?.projects?.[0]?.id;
  if (firstProjectId) {
    await runGet(`/api/public/projects/${encodeURIComponent(firstProjectId)}`);
  }

  await runGet("/api/public/updates");

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
