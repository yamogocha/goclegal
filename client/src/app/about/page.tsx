import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import AboutComponent, { AboutPage } from "../components/about";
import Navigation from "../navigation/page";
import AwardsAndHonors from "../rewards-and-honors/page";
import Contact from "../contact/page";
import Footer from "../footer/page";
import Script from "next/script";
import { attorneySchema, buildPageMetadata } from "../util/schema";

const ABOUT_PAGE_QUERY = groq`*[_type == "page" && slug.current == "about"][0]{headline, subHeadline, "image": image.asset->url, "photo": photo.asset->url, body, buttonText, phoneNumber}`

export function generateMetadata() {
    return buildPageMetadata({
        title: "About | GOC Legal",
        description: "Learn about GOC Legal’s mission, values, and dedication to protecting injured individuals across California with skilled, aggressive representation.",
        path: "about"
    })
}

export default async function About() {
    const aboutPage = await client.fetch<AboutPage>(ABOUT_PAGE_QUERY)

    return (
        <div className="relative min-h-screen">
            <Script id="attorney-schema" type="application/ld+json">
                {JSON.stringify(attorneySchema)}
            </Script>
            <Navigation />
            <AboutComponent {...aboutPage} />
            <AwardsAndHonors />
            <Contact />
            <Footer />
        </div>
    )
}