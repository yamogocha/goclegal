import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import Navigation from "../navigation/page";
import PostComponent, { Post } from "../components/post";
import Contact from "../contact/page";
import Footer from "../footer/page";

const SLIP_AND_FALL_QUERY = groq`*[_type == "post" && slug.current == "slip-and-fall-injuries"][0]
{headline, subHeadline, "image": image.asset->url, columnLeft, columnRight, buttonText, phoneNumber}`

export default async function SlipAndFallInjuries() {
    const postQuery = await client.fetch<Post>(SLIP_AND_FALL_QUERY)

    return (
        <div className="relative min-h-screen">
            <Navigation />
            <PostComponent {...postQuery} />
            <Contact />
            <Footer />
        </div>
    )
}