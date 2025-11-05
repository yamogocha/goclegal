import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import PostComponent, { Post } from "../components/post";
import Navigation from "../navigation/page";

const TRUCKING_ACCIDENTS_QUERY = groq`*[_type == "post" && slug.current == "trucking-accidents"][0]
{title, description, "image": image.asset->url, columnLeft, columnRight, buttonText, phoneNumber}`

export default async function TruckingAccidents() {
    const postQuery = await client.fetch<Post>(TRUCKING_ACCIDENTS_QUERY)

    return (
        <div className="relative min-h-screen">
            <Navigation />
            <PostComponent {...postQuery} />
        </div>
    )
}