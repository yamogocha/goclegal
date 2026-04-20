import { sitemapIndexXml } from "@/lib/sitemap"

export const runtime =  "nodejs"
const BASE_URL = process.env.BASE_URL!

export async function GET() {
    const xml = sitemapIndexXml([
        { loc: `${BASE_URL}/sitemap-pages.xml` },
        { loc: `${BASE_URL}/sitemap-posts.xml` },
    ])

    return new Response(xml, {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      });
}