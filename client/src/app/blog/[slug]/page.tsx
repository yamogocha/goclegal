import PostComponent, { Post } from "../../components/post"
import Contact from "../../contact/page"
import Footer from "../../footer/page"
import Navigation from "../../navigation/page"
// import { buildPageMetadata } from "../../util/schema"
import { client } from "@/sanity/client"
import { groq } from "next-sanity"


type Params = {
    params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
    const slugs = await client.fetch(`*[_type == "post"].slug.current`)
    return slugs.map((slug: string) => ({ slug }))
}

// export async function generateMetadata({ params }: Params) {
//     const { slug } = await params
//     return buildPageMetadata(slug)
// }

export default async function Blog({ params }: Params) {
    const { slug } = await params
    const POST_QUERY = groq`*[_type == "post" && slug.current == $slug][0]
    {title, headline, subHeadline, date, "image": image.asset->url, "imageId": image.asset->_id, columnLeft, columnRight, buttonText, phoneNumber}`
    const postQuery = await client.fetch<Post>(POST_QUERY, { slug })

    return (
        <div className="relative min-h-screen">
            {/* <Script id={`${slug}-schema`} type="application/ld+json">
                {JSON.stringify(buildPracticeAreaSchema(slug))}
            </Script> */}
            <Navigation />
            <PostComponent {...postQuery} />
            <Contact />
            <Footer />
        </div>
    )
}