import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import PostComponent, { Post } from "../components/post";
import Navigation from "../navigation/page";
import Contact from "../contact/page";

const TRAUMATIC_BRAIN_INJURY_QUERY = groq`*[_type == "post" && slug.current == "traumatic-brain-injury"][0]
{headline, subHeadline, "image": image.asset->url, columnLeft, columnRight, buttonText, phoneNumber}`

export default async function TrumaticBrainInjury() {
    const postQuery = await client.fetch<Post>(TRAUMATIC_BRAIN_INJURY_QUERY)

    return (
        <div className="relative min-h-screen">
            <Navigation />
            <PostComponent {...postQuery} />
            <Contact />
        </div>
    )
}