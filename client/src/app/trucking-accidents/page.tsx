import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import PostComponent, { Post } from "../components/post";
import Navigation from "../navigation/page";
import Contact from "../contact/page";
import Footer from "../footer/page";
import Script from "next/script";
import { buildPageMetadata, truckingAccidentsSchema } from "../util/schema";

const TRUCKING_ACCIDENTS_QUERY = groq`*[_type == "post" && slug.current == "trucking-accidents"][0]
{headline, subHeadline, "image": image.asset->url, columnLeft, columnRight, buttonText, phoneNumber}`

export function generateMetadata() {
    return buildPageMetadata({
        title: "Trucking Accidents | GOC Legal",
        description: "Serious injuries from a truck accident? We take on trucking companies and insurers to secure the compensation you deserve.",
        path: "trucking-accidents"
    })
}

export default async function TruckingAccidents() {
    const postQuery = await client.fetch<Post>(TRUCKING_ACCIDENTS_QUERY)

    return (
        <div className="relative min-h-screen">
            <Script id="trucking-accidents-schema" type="application/ld+json">
                {JSON.stringify(truckingAccidentsSchema)}
            </Script>
            <Navigation />
            <PostComponent {...postQuery} />
            <Contact />
            <Footer />
        </div>
    )
}