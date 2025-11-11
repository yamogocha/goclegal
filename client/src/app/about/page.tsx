import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import AboutComponent, { AboutPage } from "../components/about";
import Navigation from "../navigation/page";
import AwardsAndHonors from "../rewards-and-honors/page";
import Contact from "../contact/page";

const ABOUT_PAGE_QUERY = groq`*[_type == "page" && slug.current == "about"][0]{headline, subHeadline, "image": image.asset->url, "photo": photo.asset->url, body, buttonText, phoneNumber}`

export default async function About() {
    const aboutPage = await client.fetch<AboutPage>(ABOUT_PAGE_QUERY)

    return (
        <div className="relative min-h-screen">
            <Navigation />
            <AboutComponent {...aboutPage} />
            <AwardsAndHonors />
            <Contact />
        </div>
    )
}