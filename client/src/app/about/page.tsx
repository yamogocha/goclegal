import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import AboutComponent, { AboutPage } from "../components/about";
import Navigation from "../navigation/page";
import AwardsAndHonors from "../rewards-and-honors/page";
import Contact from "../contact/page";
import Footer from "../footer/page";
import Script from "next/script";
import { attorneySchema, buildPageMetadata } from "@/lib/schema";


export async function generateMetadata() {
    const pageParams = await client.fetch(`*[_type == "page" && slug.current == "about"][0]{title, description, "image": image.asset->url, "slug": slug.current}`)
    return buildPageMetadata(pageParams)
}

export default async function About() {
    const ABOUT_PAGE_QUERY = groq`*[_type == "page" && slug.current == "about"][0]{headline, subHeadline, "image": image.asset->url, "photo": photo.asset->url, body, buttonText, phoneNumber}`
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