import compression from "compression";
import express from "express";
import type { Server } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createAstroPublicRequestHandler,
  createBufferedAstroResponse,
  resolveAstroPublicRoutePayload,
  sendBufferedAstroResponse,
} from "../../server/lib/astro-public-runtime.js";

const requestText = async (baseUrl, pathname) => {
  const response = await fetch(new URL(pathname, baseUrl));
  return {
    body: await response.text(),
    headers: response.headers,
    status: response.status,
  };
};

describe("resolveAstroPublicRoutePayload", () => {
  it("builds the team payload for /equipe", async () => {
    const buildPublicMediaVariants = vi.fn(() => ({
      "/uploads/team/avatar.png": {
        variantsVersion: 3,
      },
    }));
    const buildPublicTeamMembers = vi.fn(() => [
      {
        id: "member-1",
        name: "Membro",
        avatarUrl: "/uploads/team/avatar.png",
      },
    ]);
    const loadLinkTypes = vi.fn(() => [{ id: "site", label: "Site", icon: "globe" }]);

    const payload = await resolveAstroPublicRoutePayload({
      pathname: "/equipe",
      buildPublicMediaVariants,
      buildPublicTeamMembers,
      loadLinkTypes,
    });

    expect(payload).toEqual({
      kind: "team",
      generatedAt: expect.any(String),
      mediaVariants: {
        "/uploads/team/avatar.png": {
          variantsVersion: 3,
        },
      },
      teamLinkTypes: [{ id: "site", label: "Site", icon: "globe" }],
      teamMembers: [
        {
          accessRole: "",
          avatarDisplay: "",
          avatarUrl: "/uploads/team/avatar.png",
          bio: "",
          favoriteWorks: {},
          id: "member-1",
          isAdmin: false,
          name: "Membro",
          order: undefined,
          permissions: [],
          phrase: "",
          roles: [],
          socials: [],
          status: "",
        },
      ],
    });
    expect(buildPublicMediaVariants).toHaveBeenCalledWith(
      [
        [{ id: "member-1", name: "Membro", avatarUrl: "/uploads/team/avatar.png" }],
        [{ id: "site", label: "Site", icon: "globe" }],
      ],
      {
        allowPrivateUrls: ["/uploads/team/avatar.png"],
      },
    );
  });

  it("builds the donations payload for /doacoes", async () => {
    const resolvePublicDonationsRoutePayload = vi.fn(async () => ({
      pixQrCodeUrl: "data:image/png;base64,pix",
      cryptoQrCodeUrls: {
        "0": "data:image/png;base64,btc",
      },
    }));

    const payload = await resolveAstroPublicRoutePayload({
      pathname: "/doacoes",
      pages: {
        donations: {
          pixKey: "pix-key",
        },
      },
      siteSettings: {
        site: {
          name: "Nekomata",
        },
        footer: {
          brandName: "Nekomata",
        },
      },
      resolvePublicDonationsRoutePayload,
    });

    expect(payload).toEqual({
      kind: "donations",
      generatedAt: expect.any(String),
      pixQrCodeUrl: "data:image/png;base64,pix",
      cryptoQrCodeUrls: {
        "0": "data:image/png;base64,btc",
      },
    });
    expect(resolvePublicDonationsRoutePayload).toHaveBeenCalledWith({
      donationsPage: {
        pixKey: "pix-key",
      },
      merchantName: "Nekomata",
    });
  });

  it("returns null for routes without dedicated Astro payloads", async () => {
    const payload = await resolveAstroPublicRoutePayload({
      pathname: "/sobre",
    });

    expect(payload).toBeNull();
  });

  it("prefers a custom payload resolver when provided", async () => {
    const loadAstroPublicRoutePayload = vi.fn(async () => ({
      kind: "projects-list",
      generatedAt: "2026-05-17T00:00:00.000Z",
      mediaVariants: {},
      projects: [],
      tagTranslations: {
        genres: {},
        staffRoles: {},
        tags: {},
      },
    }));

    const payload = await resolveAstroPublicRoutePayload({
      loadAstroPublicRoutePayload,
      pathname: "/projetos",
      req: {
        params: {},
      },
    });

    expect(payload).toEqual({
      kind: "projects-list",
      generatedAt: "2026-05-17T00:00:00.000Z",
      mediaVariants: {},
      projects: [],
      tagTranslations: {
        genres: {},
        staffRoles: {},
        tags: {},
      },
    });
    expect(loadAstroPublicRoutePayload).toHaveBeenCalledWith({
      pages: undefined,
      pathname: "/projetos",
      req: {
        params: {},
      },
      siteSettings: undefined,
    });
  });
});

describe("buffered Astro response delivery", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const tempDir = tempDirs.pop();
      if (!tempDir) {
        continue;
      }
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("rewrites html script nonces after buffering the Astro response", async () => {
    const buffered = createBufferedAstroResponse({
      locals: {
        cspNonce: "nonce-123",
      },
    });

    buffered.res.writeHead(200, {
      "Content-Length": "91",
      "Content-Type": "text/html; charset=utf-8",
    });
    buffered.res.write("<!doctype html><html><body>");
    buffered.res.end('<script type="module" src="/_astro/client.js"></script></body></html>');

    const destination = {
      body: Buffer.alloc(0),
      headers: new Map(),
      locals: {
        cspNonce: "nonce-123",
      },
      removeHeader: vi.fn((name) => {
        destination.headers.delete(String(name).toLowerCase());
      }),
      setHeader: vi.fn((name, value) => {
        destination.headers.set(String(name).toLowerCase(), value);
      }),
      end: vi.fn((chunk) => {
        destination.body = Buffer.from(chunk);
        return destination;
      }),
      status: vi.fn(() => destination),
    };

    await sendBufferedAstroResponse({
      destination,
      rewriteHtml: (html, nonce) => html.replace("<script", `<script nonce="${nonce}"`),
      source: buffered,
    });

    expect(destination.body.toString("utf8")).toContain(
      '<script nonce="nonce-123" type="module" src="/_astro/client.js"></script>',
    );
    expect(destination.removeHeader).toHaveBeenCalledWith("Content-Length");
  });

  it("keeps non-html payloads untouched", async () => {
    const buffered = createBufferedAstroResponse({
      locals: {
        cspNonce: "nonce-123",
      },
    });

    buffered.res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
    });
    buffered.res.end('{"ok":true}');

    const destination = {
      body: Buffer.alloc(0),
      locals: {
        cspNonce: "nonce-123",
      },
      removeHeader: vi.fn(),
      setHeader: vi.fn(),
      end: vi.fn((chunk) => {
        destination.body = Buffer.from(chunk);
        return destination;
      }),
      status: vi.fn(() => destination),
    };

    await sendBufferedAstroResponse({
      destination,
      rewriteHtml: (html) => `${html}<!-- rewritten -->`,
      source: buffered,
    });

    expect(destination.body.toString("utf8")).toBe('{"ok":true}');
  });

  it("completes a real Astro public response with bootstrap injection and nonce rewriting", async () => {
    const tempDir = mkdtempSync(path.join(process.cwd(), "tmp-astro-handler-"));
    tempDirs.push(tempDir);
    const entryFilePath = path.join(tempDir, "entry.mjs");
    writeFileSync(
      entryFilePath,
      [
        "export const handler = async (_req, res, _next, locals) => {",
        "  res.writeHead(200, {",
        '    "Content-Type": "text/html; charset=utf-8",',
        '    "X-Route": "astro-test",',
        "  });",
        '  res.write("<!doctype html><html><body>");',
        '  res.end(`<script type="module">window.__origin=${JSON.stringify(locals.nekomata.primaryAppOrigin)};</script></body></html>`);',
        "};",
      ].join("\n"),
      "utf8",
    );

    const app = express();
    app.use(compression());
    app.use((_req, res, next) => {
      res.locals.cspNonce = "nonce-xyz";
      next();
    });

    const handler = createAstroPublicRequestHandler({
      entryFilePath,
      fs: {
        existsSync: (candidate) => candidate === entryFilePath,
      },
      injectNonceIntoHtmlScripts: (html, nonce) =>
        html.replace("<script", `<script nonce="${nonce}"`),
      injectAstroPublicHtml: async ({ html, publicRoutePayload, settings }) =>
        `${html}<script>window.__BOOTSTRAP_ROUTE__ = ${JSON.stringify(publicRoutePayload)};window.__BOOTSTRAP_SETTINGS__ = ${JSON.stringify(settings)};</script>`,
      isProduction: true,
      loadAstroPublicBootstrap: () => null,
      loadAstroFallbackRoutePayload: ({ routePayload }) => routePayload,
      loadAstroRoutePayload: () => ({
        kind: "team",
        generatedAt: "2026-05-17T00:00:00.000Z",
        teamMembers: [{ id: "member-1" }],
      }),
      loadPages: () => null,
      loadSiteSettings: () => ({
        theme: {
          mode: "light",
        },
      }),
      primaryAppOrigin: "http://127.0.0.1:0",
    });

    app.get("/equipe", (req, res, next) => {
      void handler(req, res, next);
    });

    const server = await new Promise<Server>((resolve) => {
      const nextServer = app.listen(0, () => resolve(nextServer));
    });

    try {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const baseUrl = new URL(`http://127.0.0.1:${port}`);
      const response = await requestText(baseUrl, "/equipe");

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(response.headers.get("x-route")).toBe("astro-test");
      expect(response.body).toContain('nonce="nonce-xyz"');
      expect(response.body).toContain("window.__origin=");
      expect(response.body).toContain("http://127.0.0.1:0");
      expect(response.body).toContain('window.__BOOTSTRAP_SETTINGS__ = {"theme":{"mode":"light"}}');
      expect(response.body).toContain('window.__BOOTSTRAP_ROUTE__ = {"kind":"team"');
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(undefined);
        });
      });
    }
  });

  it("repairs incomplete institutional route payloads before Astro renders", async () => {
    const tempDir = mkdtempSync(path.join(process.cwd(), "tmp-astro-handler-"));
    tempDirs.push(tempDir);
    const entryFilePath = path.join(tempDir, "entry.mjs");
    writeFileSync(
      entryFilePath,
      [
        "export const handler = async (_req, res, _next, locals) => {",
        '  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });',
        "  res.end(`<!doctype html><html><body>${JSON.stringify(locals.nekomata.routePayload)}</body></html>`);",
        "};",
      ].join("\n"),
      "utf8",
    );

    const app = express();
    const handler = createAstroPublicRequestHandler({
      entryFilePath,
      fs: {
        existsSync: (candidate) => candidate === entryFilePath,
      },
      injectAstroPublicHtml: ({ html }) => html,
      isProduction: true,
      loadAstroFallbackRoutePayload: async ({ pathname, routePayload }) => {
        if (pathname !== "/doacoes" || routePayload?.pixQrCodeUrl) {
          return routePayload;
        }
        return {
          kind: "donations",
          generatedAt: "2026-05-17T00:00:00.000Z",
          pixQrCodeUrl: "data:image/png;base64,pix",
          cryptoQrCodeUrls: { "0": "data:image/png;base64,btc" },
        };
      },
      loadAstroPublicBootstrap: () => null,
      loadAstroRoutePayload: () => ({
        kind: "donations",
        generatedAt: "2026-05-17T00:00:00.000Z",
        pixQrCodeUrl: "",
        cryptoQrCodeUrls: {},
      }),
      loadPages: () => null,
      loadSiteSettings: () => null,
      primaryAppOrigin: "http://127.0.0.1:0",
    });

    app.get("/doacoes", (req, res, next) => {
      void handler(req, res, next);
    });

    const server = await new Promise<Server>((resolve) => {
      const nextServer = app.listen(0, () => resolve(nextServer));
    });

    try {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const baseUrl = new URL(`http://127.0.0.1:${port}`);
      const response = await requestText(baseUrl, "/doacoes");

      expect(response.status).toBe(200);
      expect(response.body).toContain('"pixQrCodeUrl":"data:image/png;base64,pix"');
      expect(response.body).toContain('"cryptoQrCodeUrls":{"0":"data:image/png;base64,btc"}');
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(undefined);
        });
      });
    }
  });
});
