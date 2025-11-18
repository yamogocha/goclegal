import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import PostComponent, { Post } from "../components/post";
import Navigation from "../navigation/page";
import Contact from "../contact/page";
import Footer from "../footer/page";
import Script from "next/script";
import { buildPageMetadata, constructionAccidentsSchema } from "../util/schema";

const CONSTRUCTION_SITE_ACCIDENTS_QUERY = groq`*[_type == "post" && slug.current == "construction-site-accidents"][0]
{headline, subHeadline, "image": image.asset->url, columnLeft, columnRight, buttonText, phoneNumber}`

export function generateMetadata() {
    return buildPageMetadata({
        title: "Construction Site Accidents | GOC Legal",
        description: "Injured on a construction site? Our attorneys handle workplace injury claims and fight for compensation beyond workers’ compensation benefits.",
        path: "construction-site-accidents"
    })
}

export default async function ConstructionSiteAccidents() {
    const postQuery = await client.fetch<Post>(CONSTRUCTION_SITE_ACCIDENTS_QUERY)

    return (
        <div className="relative min-h-screen">
            <Script id="construction-accidents-schema" type="application/ld+json">
                {JSON.stringify(constructionAccidentsSchema)}
            </Script>
            <Navigation />
            <PostComponent {...postQuery} />
            <Contact />
            <Footer />
        </div>
    )
}