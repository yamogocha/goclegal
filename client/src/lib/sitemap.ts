export function escapeXml(value: string) {
    return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

export function urlTag(loc: string, lastmod: string) {
    const updatedLoc = escapeXml(loc)
    const updatedLastmod = escapeXml(lastmod)
    return [`<url>`, `<loc>${updatedLoc}</loc>`, updatedLastmod ? `<lastmod>${updatedLastmod}</lastmod>` : "", `</url>`].filter(Boolean).join("\n")
}

export function urlsetXml(urlTags: string[]) {
    return [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
      ...urlTags,
      `</urlset>`,
      "",
    ].join("\n");
  }

  export function sitemapIndexXml(items: {loc: string}[]) {
    const body = items.map(({ loc }) => {
        const updatedLoc = escapeXml(loc)
        return [`<sitemap>`, `<loc>${updatedLoc}</loc>`, `</sitemap>`]
    }).join("\n")

    return [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
        body,
        `</sitemapindex>`,
        "",
      ].join("\n");
  }