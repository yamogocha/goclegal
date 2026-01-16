import { notFound } from "next/navigation"
import BlogComponent, { BlogItem } from "../components/blog"
import Contact from "../contact/page"
import Footer from "../footer/page"
import Navigation from "../navigation/page"
import { client } from "@/sanity/client"
import { groq } from "next-sanity"

type SearchParams = {
    searchParams?: Promise<{ page: string }>
}
export default async function Blog({ searchParams }: SearchParams) {
    const params = await searchParams
    const page = Number(params?.page ?? "1")
    if (!Number.isFinite(page) || page < 1) notFound()

    const LATEST_POST_QUERY = groq`*[_type == "post" && defined(date)] | order(date desc)[0]
    {title, "slug": slug.current, headline, date, "image": image.asset->url, "imageId": image.asset->_id, columnLeft, buttonText, phoneNumber}`
    const latestPost = await client.fetch<BlogItem>(LATEST_POST_QUERY)
    const POST_PER_PAGE = 6
    
    async function getPostsQuery(page: number) {
        const safePage = Number.isFinite(page) && page > 0 ? page : 1
        const start = (safePage - 1) * POST_PER_PAGE
        const end = start + POST_PER_PAGE
        const total = await client.fetch<number>(`count(*[_type == "post" && defined(date)])`)
        const pages = Math.max(1, Math.ceil(total / POST_PER_PAGE))

        const POSTS_QUERY = groq`*[_type == "post" && defined(date)] | order(date desc)[$start...$end]
        {title, "slug": slug.current, headline, date, "image": image.asset->url, "imageId": image.asset->_id, columnLeft, buttonText, phoneNumber}`
        const posts = await client.fetch<BlogItem[]>(POSTS_QUERY, { start, end })
        return { posts, pages }
    }
    const { posts, pages } = await getPostsQuery(page)
    const postsQuery = {latestPost, posts, current: page, pages}


    return (
        <div className="relative min-h-screen">
            {/* <Script id={`${slug}-schema`} type="application/ld+json">
                {JSON.stringify(buildPracticeAreaSchema(slug))}
            </Script> */}
            <Navigation />
            <BlogComponent {...postsQuery} />
            <Contact />
            <Footer />
        </div>
    )
}