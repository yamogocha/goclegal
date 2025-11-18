import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import PostComponent, { Post } from "../components/post";
import Navigation from "../navigation/page";
import Contact from "../contact/page";
import Footer from "../footer/page";
import Script from "next/script";
import { bicycleAccidentsSchema, buildPageMetadata } from "../util/schema";

const BICYCLE_ACCIDENTS_QUERY = groq`*[_type == "post" && slug.current == "bicycle-accidents"][0]
{headline, subHeadline, "image": image.asset->url, columnLeft, columnRight, buttonText, phoneNumber}`

export function generateMetadata() {
    return buildPageMetadata({
        title: "Bicycle Accidents | GOC Legal",
        description: "Hurt in a bicycle accident? We protect injured cyclists and fight for compensation for medical bills, lost wages, and pain and suffering.",
        path: "bicycle-accidents"
    })
}

export default async function BicycleAccidents() {
    const postQuery = await client.fetch<Post>(BICYCLE_ACCIDENTS_QUERY)

    return (
        <div className="relative min-h-screen">
            <Script id="attorney-schema" type="application/ld+json">
                {JSON.stringify(bicycleAccidentsSchema)}
            </Script>
            <Navigation />
            <PostComponent {...postQuery} />
            <Contact />
            <Footer />
        </div>
    )
}