import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import PostComponent, { Post } from "../components/post";
import Navigation from "../navigation/page";
import Contact from "../contact/page";
import Footer from "../footer/page";
import Script from "next/script";
import { buildPracticeAreaSchema, buildPageMetadata } from "@/lib/schema";


type Params = {
    params: Promise<{
        slug: string
    }>
}

export async function generateStaticParams() {
    const slugs = await client.fetch(`*[_type=="post"].slug.current`);
    return slugs.map((slug: string) => ({ slug }));
}

export async function generateMetadata({ params }: Params) {
    const { slug } = await params
    const postParams = await client.fetch(`*[_type == "post" && slug.current == $slug][0]{title, description, "image": image.asset->url, "slug": $slug}`,{ slug })
    return buildPageMetadata(postParams)
}

export default async function PracticeAreas({ params }: Params) {
    const { slug } = await params
    const AUTO_ACCIDENTS_QUERY = groq`*[_type == "post" && slug.current == $slug][0]
{title, description, headline, subHeadline, date, "image": image.asset->url, "imageId": image.asset->_id, columnLeft, columnRight, buttonText, phoneNumber}`
    

    const postQuery = await client.fetch<Post>(AUTO_ACCIDENTS_QUERY,{ slug })
    const postParams = await client.fetch(`*[_type == "post" && slug.current == $slug][0]{title, description, "image": image.asset->url, "slug": $slug}`,{ slug })

    return (
        <div className="relative min-h-screen">
            <Script id={`${slug}-schema`} type="application/ld+json">
                {JSON.stringify(buildPracticeAreaSchema(postParams))}
            </Script>
            <Navigation />
            <PostComponent {...postQuery} />
            <Contact />
            <Footer />
        </div>
    )
}