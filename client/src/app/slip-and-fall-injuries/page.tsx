import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import Navigation from "../navigation/page";
import PostComponent, { Post } from "../components/post";
import Contact from "../contact/page";
import Footer from "../footer/page";
import Script from "next/script";
import { buildPageMetadata, slipFallSchema } from "../util/schema";

const SLIP_AND_FALL_QUERY = groq`*[_type == "post" && slug.current == "slip-and-fall-injuries"][0]
{headline, subHeadline, "image": image.asset->url, columnLeft, columnRight, buttonText, phoneNumber}`

export function generateMetadata() {
    return buildPageMetadata({
        title: "Slip and Fall Injuries | GOC Legal",
        description: "Injured in a slip and fall? Our premises liability lawyers hold negligent property owners accountable. Get expert guidance and a free consultation.",
        path: "slip-and-fall-injuries"
    })
}

export default async function SlipAndFallInjuries() {
    const postQuery = await client.fetch<Post>(SLIP_AND_FALL_QUERY)

    return (
        <div className="relative min-h-screen">
            <Script id="slip-fall-schema" type="application/ld+json">
                {JSON.stringify(slipFallSchema)}
            </Script>
            <Navigation />
            <PostComponent {...postQuery} />
            <Contact />
            <Footer />
        </div>
    )
}