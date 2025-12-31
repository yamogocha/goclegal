import { sitemapIndexXml } from "@/lib/sitemap"

export const runtime =  "nodejs"
const SITE_URL = process.env.SITE_URL!

export async function GET() {
    const xml = sitemapIndexXml([
        { loc: `${SITE_URL}/sitemap-pages.xml` },
        { loc: `${SITE_URL}/sitemap-posts.xml` },
    ])

    return new Response(xml, {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      });
}