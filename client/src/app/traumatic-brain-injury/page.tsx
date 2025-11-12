import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import PostComponent, { Post } from "../components/post";
import Navigation from "../navigation/page";
import Contact from "../contact/page";
import Footer from "../footer/page";
import Script from "next/script";
import { traumaticBrainInjurySchema } from "../util/schema";

const TRAUMATIC_BRAIN_INJURY_QUERY = groq`*[_type == "post" && slug.current == "traumatic-brain-injury"][0]
{headline, subHeadline, "image": image.asset->url, columnLeft, columnRight, buttonText, phoneNumber}`

export default async function TrumaticBrainInjury() {
    const postQuery = await client.fetch<Post>(TRAUMATIC_BRAIN_INJURY_QUERY)

    return (
        <div className="relative min-h-screen">
            <Script id="traumatic-brain-injury-schema" type="application/ld+json">
                {JSON.stringify(traumaticBrainInjurySchema)}
            </Script>
            <Navigation />
            <PostComponent {...postQuery} />
            <Contact />
            <Footer />
        </div>
    )
}