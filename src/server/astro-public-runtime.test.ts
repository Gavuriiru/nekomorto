import { describe, expect, it, vi } from "vitest";

import {
  attachAstroHtmlNonceInjection,
  resolveAstroPublicRoutePayload,
} from "../../server/lib/astro-public-runtime.js";

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

describe("attachAstroHtmlNonceInjection", () => {
  const createResponse = ({
    contentType = "text/html; charset=utf-8",
    cspNonce = "nonce-123",
  }: {
    contentType?: string;
    cspNonce?: string;
  } = {}) => {
    const headers = new Map<string, string>([["Content-Type", contentType]]);
    const writes: Buffer[] = [];
    const res = {
      locals: {
        cspNonce,
      },
      end: vi.fn((chunk?: Buffer | string, _encoding?: BufferEncoding, callback?: () => void) => {
        if (chunk !== undefined) {
          writes.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8"));
        }
        callback?.();
        return res;
      }),
      getHeader: vi.fn((name: string) => headers.get(name)),
      removeHeader: vi.fn((name: string) => {
        headers.delete(name);
      }),
      write: vi.fn((chunk?: Buffer | string, _encoding?: BufferEncoding, callback?: () => void) => {
        if (chunk !== undefined) {
          writes.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8"));
        }
        callback?.();
        return true;
      }),
    };

    return {
      getBody: () => Buffer.concat(writes).toString("utf8"),
      res,
    };
  };

  it("injects the current nonce into buffered Astro HTML scripts", () => {
    const { getBody, res } = createResponse();

    attachAstroHtmlNonceInjection({
      res,
      injectNonceIntoHtmlScripts: (html, nonce) => html.replace("<script", `<script nonce="${nonce}"`),
    });

    res.write("<!doctype html><html><body>");
    res.end('<script type="module" src="/_astro/client.js"></script></body></html>');

    expect(getBody()).toContain('<script nonce="nonce-123" type="module" src="/_astro/client.js"></script>');
    expect(res.removeHeader).toHaveBeenCalledWith("Content-Length");
  });

  it("passes the full html to the nonce injector so existing nonce values are replaced", () => {
    const { getBody, res } = createResponse();

    attachAstroHtmlNonceInjection({
      res,
      injectNonceIntoHtmlScripts: (html, nonce) =>
        html.replace(/nonce="antigo"/g, `nonce="${nonce}"`).replace(/nonce='antigo'/g, `nonce="${nonce}"`),
    });

    res.end('<!doctype html><html><body><script nonce="antigo">window.Astro={};</script></body></html>');

    expect(getBody()).toContain('<script nonce="nonce-123">window.Astro={};</script>');
    expect(getBody()).not.toContain("antigo");
  });

  it("leaves non-html responses untouched", () => {
    const { getBody, res } = createResponse({
      contentType: "application/json; charset=utf-8",
    });

    attachAstroHtmlNonceInjection({
      res,
      injectNonceIntoHtmlScripts: (html) => `${html}<!-- rewritten -->`,
    });

    res.end('{"ok":true}');

    expect(getBody()).toBe('{"ok":true}');
  });

  it("leaves the body untouched when there is no nonce on the response", () => {
    const { getBody, res } = createResponse({
      cspNonce: "",
    });

    attachAstroHtmlNonceInjection({
      res,
      injectNonceIntoHtmlScripts: (html) => `${html}<!-- rewritten -->`,
    });

    res.end("<!doctype html><html><body><script></script></body></html>");

    expect(getBody()).toBe("<!doctype html><html><body><script></script></body></html>");
  });
});
