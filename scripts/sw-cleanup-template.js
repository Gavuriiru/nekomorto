const BUILD_FINGERPRINT = __BUILD_FINGERPRINT__;
const DASHBOARD_PATH_PATTERN = /^\/dashboard(?:\/|$)/;

const isPublicClient = (clientUrl) => {
  try {
    const parsedUrl = new URL(String(clientUrl || ""), self.location.origin);
    return parsedUrl.origin === self.location.origin && !DASHBOARD_PATH_PATTERN.test(parsedUrl.pathname);
  } catch {
    return false;
  }
};

const notifyClientForReload = async (client) => {
  try {
    client.postMessage({
      type: "NEKOMATA_SW_CLEANUP_RELOAD",
      build: BUILD_FINGERPRINT,
    });
  } catch {
    // Ignore postMessage failures for detached clients.
  }

  if (!isPublicClient(client?.url) || typeof client?.navigate !== "function") {
    return;
  }

  try {
    await client.navigate(client.url);
  } catch {
    // Ignore navigation failures for clients that disappear mid-cleanup.
  }
};

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        await self.clients.claim();
      } catch {
        // Continue cleanup even if claim fails.
      }

      let cacheKeys = [];
      try {
        cacheKeys = await caches.keys();
      } catch {
        cacheKeys = [];
      }
      await Promise.all(
        cacheKeys.map(async (cacheKey) => {
          try {
            await caches.delete(cacheKey);
          } catch {
            // Ignore cache deletion failures and keep cleaning.
          }
        }),
      );

      let clients = [];
      try {
        clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
      } catch {
        clients = [];
      }

      await Promise.all(clients.map((client) => notifyClientForReload(client)));

      try {
        await self.registration.unregister();
      } catch {
        // Ignore unregister failures because the page-side cleanup will retry.
      }
    })(),
  );
});
