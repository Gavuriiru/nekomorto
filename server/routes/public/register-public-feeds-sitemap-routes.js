export const registerPublicFeedsSitemapRoutes = ({
  PRIMARY_APP_ORIGIN,
  app,
  buildLaunchesRssItems,
  buildPostsRssItems,
  buildPublicSitemapEntries,
  buildRssXml,
  buildSitemapXml,
  loadSiteSettings,
  sendXmlResponse,
} = {}) => {
  app.get("/sitemap.xml", (_req, res) => {
    const xml = buildSitemapXml(buildPublicSitemapEntries());
    return sendXmlResponse(res, xml, "application/xml; charset=utf-8");
  });

  app.get("/api/public/sitemap.xml", (_req, res) => {
    const xml = buildSitemapXml(buildPublicSitemapEntries());
    return sendXmlResponse(res, xml, "application/xml; charset=utf-8");
  });

  app.get("/rss/posts.xml", (_req, res) => {
    const settings = loadSiteSettings();
    const xml = buildRssXml({
      title: `${settings?.site?.name || "Nekomata"} â€¢ Posts`,
      link: PRIMARY_APP_ORIGIN,
      description: "Feed de postagens publicadas",
      selfUrl: `${PRIMARY_APP_ORIGIN}/rss/posts.xml`,
      items: buildPostsRssItems(),
    });
    return sendXmlResponse(res, xml, "application/rss+xml; charset=utf-8");
  });

  app.get("/rss/lancamentos.xml", (_req, res) => {
    const settings = loadSiteSettings();
    const xml = buildRssXml({
      title: `${settings?.site?.name || "Nekomata"} â€¢ LanÃ§amentos`,
      link: `${PRIMARY_APP_ORIGIN}/projetos`,
      description: "Feed de lanÃ§amentos e ajustes de projetos",
      selfUrl: `${PRIMARY_APP_ORIGIN}/rss/lancamentos.xml`,
      items: buildLaunchesRssItems(),
    });
    return sendXmlResponse(res, xml, "application/rss+xml; charset=utf-8");
  });

  app.get("/api/public/rss.xml", (req, res) => {
    const feed = String(req.query.feed || "posts")
      .trim()
      .toLowerCase();
    if (feed === "lancamentos") {
      const settings = loadSiteSettings();
      const xml = buildRssXml({
        title: `${settings?.site?.name || "Nekomata"} â€¢ LanÃ§amentos`,
        link: `${PRIMARY_APP_ORIGIN}/projetos`,
        description: "Feed de lanÃ§amentos e ajustes de projetos",
        selfUrl: `${PRIMARY_APP_ORIGIN}/api/public/rss.xml?feed=lancamentos`,
        items: buildLaunchesRssItems(),
      });
      return sendXmlResponse(res, xml, "application/rss+xml; charset=utf-8");
    }
    const settings = loadSiteSettings();
    const xml = buildRssXml({
      title: `${settings?.site?.name || "Nekomata"} â€¢ Posts`,
      link: PRIMARY_APP_ORIGIN,
      description: "Feed de postagens publicadas",
      selfUrl: `${PRIMARY_APP_ORIGIN}/api/public/rss.xml?feed=posts`,
      items: buildPostsRssItems(),
    });
    return sendXmlResponse(res, xml, "application/rss+xml; charset=utf-8");
  });
};

export default registerPublicFeedsSitemapRoutes;
