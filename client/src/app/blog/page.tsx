import BlogComponent, { BlogItem } from "../components/blog"
import Contact from "../contact/page"
import Footer from "../footer/page"
import Navigation from "../navigation/page"
import { client } from "@/sanity/client"
import { groq } from "next-sanity"



export default async function Blog() {
    const LATEST_POST_QUERY = groq`*[_type == "post" && defined(date)] | order(date desc)[0]
    {title, "slug": slug.current, headline, date, "image": image.asset->url, "imageId": image.asset->_id, columnLeft, buttonText, phoneNumber}`
    const POSTS_QUERY = groq`*[_type == "post" && defined(date)] | order(date desc)
    {title, "slug": slug.current, headline, date, "image": image.asset->url, "imageId": image.asset->_id, columnLeft, buttonText, phoneNumber}`
    const latestPost = await client.fetch<BlogItem>(LATEST_POST_QUERY)
    const posts = await client.fetch<BlogItem[]>(POSTS_QUERY)
    const postsQuery = {latestPost, posts}


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