import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import PostComponent, { Post } from "../components/post";
import Navigation from "../navigation/page";

const WRONGFUL_DEATH_QUERY = groq`*[_type == "post" && slug.current == "wrongful-death"][0]
{title, description, "image": image.asset->url, columnLeft, columnRight, buttonText, phoneNumber}`

export default async function WrongfulDeath() {
    const postQuery = await client.fetch<Post>(WRONGFUL_DEATH_QUERY)

    return (
        <>
            <Navigation />
            <PostComponent {...postQuery} />
        </>
    )
}