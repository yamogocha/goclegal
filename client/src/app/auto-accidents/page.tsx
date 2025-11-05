import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import PostComponent, { Post } from "../components/post";
import Navigation from "../navigation/page";

const AUTO_ACCIDENTS_QUERY = groq`*[_type == "post" && slug.current == "auto-accidents"][0]
{title, description, "image": image.asset->url, columnLeft, columnRight, buttonText, phoneNumber}`

export default async function AutoAccidents() {
    const postQuery = await client.fetch<Post>(AUTO_ACCIDENTS_QUERY)

    return (
        <div className="relative min-h-screen">
            <Navigation />
            <PostComponent {...postQuery} />
        </div>
    )
}