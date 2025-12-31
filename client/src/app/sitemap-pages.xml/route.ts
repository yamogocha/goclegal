import { client } from "@/sanity/client"
import { urlsetXml, urlTag } from "../util/sitemap"

export const runtime = "nodejs"
const SITE_URL = process.env.SITE_URL!

type PageItems = {
    slug: string
    updatedAt: string
}

export async function GET() {
    const pages = await client.fetch<PageItems[]>(`*[_type == "Page" && defined(slug_current)]{"slug": slug.current, "updatedAt": coalesce(_updatedAt, _createdAt)}`)

    const urlTags = pages.map(({ slug, updatedAt }) => {
        const loc = `${SITE_URL}/${slug}`
        const lastmod = updatedAt

        return urlTag(loc, lastmod)
    })
    const xml = urlsetXml(urlTags)

    return new Response(xml, {
        headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        }
    })
}