import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import AboutComponent, { AboutPage } from "../components/about";
import Navigation from "../navigation/page";
import AwardsAndHonors from "../rewards-and-honors/page";
import Contact from "../contact/page";
import Footer from "../footer/page";
import Script from "next/script";
import { attorneySchema, buildPageMetadata } from "../util/schema";

type Params = {
    params: Promise<{
        slug: string
    }>
}

export async function generateStaticParams() {
    const slugs = await client.fetch(`*[_type=="post"].slug.current`);
    return slugs.map((slug: string) => ({ slug }));
}

const ABOUT_PAGE_QUERY = groq`*[_type == "page" && slug.current == "about"][0]{headline, subHeadline, "image": image.asset->url, "photo": photo.asset->url, body, buttonText, phoneNumber}`

export async function generateMetadata({ params }: Params) {
    const { slug } = await params
    return buildPageMetadata(slug)
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