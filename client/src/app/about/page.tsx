import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import AboutComponent, { AboutPage } from "../components/about";
import Navigation from "../navigation/page";
import AwardsAndHonors from "../rewards-and-honors/page";

const ABOUT_PAGE_QUERY = groq`*[_type == "page" && slug.current == "about"][0]{title, description, "image": image.asset->url, "photo": photo.asset->url, body}`

export default async function About() {
    const aboutPage = await client.fetch<AboutPage>(ABOUT_PAGE_QUERY)

    return (
        <>
            <Navigation />
            <AboutComponent {...aboutPage} />
            <AwardsAndHonors />
        </>
    )
}