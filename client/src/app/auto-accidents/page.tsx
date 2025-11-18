import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import PostComponent, { Post } from "../components/post";
import Navigation from "../navigation/page";
import Contact from "../contact/page";
import Footer from "../footer/page";
import Script from "next/script";
import { autoAccidentsSchema, buildPageMetadata } from "../util/schema";

const AUTO_ACCIDENTS_QUERY = groq`*[_type == "post" && slug.current == "auto-accidents"][0]
{headline, subHeadline, "image": image.asset->url, columnLeft, columnRight, buttonText, phoneNumber}`

export function generateMetadata() {
    return buildPageMetadata({
        title: "Auto Accidents | GOC Legal",
        description: "Experienced California auto accident attorneys fighting for maximum compensation after injuries. Get trusted legal help and a free case evaluation.",
        path: "auto-accidents"
    })
}

export default async function AutoAccidents() {
    const postQuery = await client.fetch<Post>(AUTO_ACCIDENTS_QUERY)

    return (
        <div className="relative min-h-screen">
            <Script id="auto-accidents-schema" type="application/ld+json">
                {JSON.stringify(autoAccidentsSchema)}
            </Script>
            <Navigation />
            <PostComponent {...postQuery} />
            <Contact />
            <Footer />
        </div>
    )
}